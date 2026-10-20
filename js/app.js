"use strict";
/*
 * API endpoints used by CityScope:
 * Geocoding: https://open-meteo.com/en/docs/geocoding-api
 * Forecast: https://open-meteo.com/en/docs
 * Air quality: https://open-meteo.com/en/docs/air-quality-api
 * Daylight: https://sunrise-sunset.org/api
 * Requests can fail, so keep the loading and error states.
 */
const $ = id => document.getElementById(id);
const presets = {
  manchester: { name: "Manchester", country: "United Kingdom", latitude: 53.4808, longitude: -2.2426, timezone: "Europe/London" },
  dubai: { name: "Dubai", country: "United Arab Emirates", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai" },
  tokyo: { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
  nairobi: { name: "Nairobi", country: "Kenya", latitude: -1.2864, longitude: 36.8172, timezone: "Africa/Nairobi" },
  sydney: { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" }
};
const state = { primary: null, secondary: null, unit: "celsius", days: 3, includeAir: true, aqiThreshold: 60, primaryController: null, secondaryController: null, searchController: null, compareSearchController: null };
function text(id, value) { $(id).textContent = value; }
function status(id, message, tone = "") { text(id, message); $(id).dataset.tone = tone; }
function fmtNumber(value, decimals = 0) { return Number.isFinite(Number(value)) && value !== null && value !== undefined ? Number(value).toFixed(decimals) : "—"; }
function temp(value) { return value == null ? "—" : `${Math.round(value)}°`; }
function weatherKind(code) {
  if (code === 0) return { label: "Clear sky", icon: "☀" };
  if ([1, 2].includes(code)) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁" };
  if ([45, 48].includes(code)) return { label: "Foggy", icon: "≋" };
  if ([51,53,55,56,57].includes(code)) return { label: "Drizzle", icon: "🌦" };
  if ([61,63,65,66,67,80,81,82].includes(code)) return { label: "Rain", icon: "🌧" };
  if ([71,73,75,77,85,86].includes(code)) return { label: "Snow", icon: "❄" };
  if ([95,96,99].includes(code)) return { label: "Thunderstorms", icon: "⛈" };
  return { label: "Conditions unavailable", icon: "◌" };
}
function airLevel(index) {
  if (index == null || !Number.isFinite(Number(index))) return { name: "Unavailable", key: "unknown", explanation: "Air-quality readings aren't available right now." };
  // European AQI bands (Open-Meteo / EEA scale).
  if (index <= 20) return { name: "Good", key: "good", explanation: "Modelled air quality falls in the Good European AQI band." };
  if (index <= 40) return { name: "Fair", key: "fair", explanation: "Modelled air quality falls in the Fair European AQI band." };
  if (index <= 60) return { name: "Moderate", key: "moderate", explanation: "Modelled air quality falls in the Moderate European AQI band." };
  if (index <= 80) return { name: "Poor", key: "poor", explanation: "Modelled air quality falls in the Poor European AQI band." };
  if (index <= 100) return { name: "Very poor", key: "very-poor", explanation: "Modelled air quality falls in the Very poor European AQI band." };
  return { name: "Extremely poor", key: "very-poor", explanation: "Modelled air quality falls in the Extremely poor European AQI band." };
}
function locationDisplay(location) { return [location.name, location.admin1, location.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v) === i).join(", "); }
function shortLocalTime(iso, timezone) {
  if (!iso) return "—";
  try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone || "UTC" }).format(new Date(iso)); }
  catch { return "—"; }
}
function localDate(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", { year:"numeric", month:"2-digit", day:"2-digit", timeZone: timezone || "UTC" }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function fetchJson(url, signal) {
  return fetch(url, { signal, headers: { Accept: "application/json" } }).then(async response => {
    if (!response.ok) throw new Error(`The data provider returned HTTP ${response.status}.`);
    const json = await response.json();
    if (json.error) throw new Error(json.reason || "The service reported an error.");
    return json;
  });
}
function makeWeatherUrl(loc) {
  const args = new URLSearchParams({ latitude: loc.latitude, longitude: loc.longitude, current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m", hourly: "temperature_2m,precipitation_probability", daily: "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset", forecast_days: String(state.days), temperature_unit: state.unit, wind_speed_unit: "kmh", timezone: "auto" });
  return `https://api.open-meteo.com/v1/forecast?${args}`;
}
function makeAirUrl(loc) {
  const args = new URLSearchParams({ latitude: loc.latitude, longitude: loc.longitude, current: "european_aqi,pm2_5,pm10", timezone: "auto" });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${args}`;
}
function makeSunUrl(loc) {
  const args = new URLSearchParams({ lat: loc.latitude, lng: loc.longitude, date: localDate(loc.timezone) });
  return `https://api.sunrise-sunset.org/v2?${args}`;
}
async function getLocationData(loc, signal, includeExtras = true) {
  const responses = await Promise.allSettled([
    fetchJson(makeWeatherUrl(loc), signal),
    state.includeAir ? fetchJson(makeAirUrl(loc), signal) : Promise.resolve(null),
    includeExtras ? fetchJson(makeSunUrl(loc), signal) : Promise.resolve(null)
  ]);
  if (responses[0].status === "rejected") throw responses[0].reason;
  const forecast = responses[0].value;
  if (!forecast.current || !forecast.hourly || !forecast.daily) throw new Error("Weather data was incomplete. Please try another city.");
  return {
    location: { ...loc, timezone: forecast.timezone || loc.timezone }, forecast,
    air: responses[1].status === "fulfilled" ? responses[1].value : null,
    sun: responses[2].status === "fulfilled" && typeof responses[2].value?.sunrise === "string" && typeof responses[2].value?.sunset === "string" ? responses[2].value : null,
    airFailed: state.includeAir && responses[1].status === "rejected",
    sunFailed: includeExtras && (responses[2].status === "rejected" || (typeof responses[2].value?.sunrise !== "string" || typeof responses[2].value?.sunset !== "string"))
  };
}
function clearSearchResults(target) { $(target).replaceChildren(); $(target).hidden = true; }
function showLocations(containerId, records, onChoose) {
  const container = $(containerId); container.replaceChildren();
  if (!records.length) { container.hidden = true; return; }
  const heading = document.createElement("strong"); heading.textContent = `Choose a location (${records.length} matches)`; container.append(heading);
  records.forEach(loc => {
    const choice = document.createElement("button"); choice.type = "button"; choice.textContent = locationDisplay(loc);
    choice.addEventListener("click", () => { clearSearchResults(containerId); onChoose(loc); });
    container.append(choice);
  });
  container.hidden = false;
  container.querySelector("button")?.focus();
}
async function geocode(query, signal) {
  const qs = new URLSearchParams({ name: query.trim(), count: "6", language: "en", format: "json" });
  const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${qs}`, signal);
  return (data.results || []).filter(row => typeof row.latitude === "number" && typeof row.longitude === "number").map(row => ({ name: row.name, admin1: row.admin1, country: row.country, latitude: row.latitude, longitude: row.longitude, timezone: row.timezone || "UTC" }));
}
async function runSearch(query, target) {
  const isCompare = target === "compare";
  const controllerKey = isCompare ? "compareSearchController" : "searchController";
  const resultId = isCompare ? "compare-results" : "search-results";
  const messageId = isCompare ? "compare-message" : "search-message";
  state[controllerKey]?.abort();
  const controller = new AbortController(); state[controllerKey] = controller;
  clearSearchResults(resultId); status(messageId, "Looking for matching cities…");
  try {
    const results = await geocode(query, controller.signal);
    if (controller.signal.aborted) return;
    if (!results.length) { status(messageId, "No matches found. Try a different spelling or add a country.", "error"); return; }
    status(messageId, "Select your intended location from the results.", "success");
    showLocations(resultId, results, isCompare ? loadSecondary : loadPrimary);
  } catch (error) {
    if (!controller.signal.aborted) status(messageId, `City search failed: ${error.message}`, "error");
  }
}
function updateTheme(theme) {
  document.body.dataset.theme = theme;
  const dark = theme === "dark";
  $("theme-toggle").setAttribute("aria-pressed", String(dark));
  $("theme-toggle").setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} theme`);
  text("theme-label", dark ? "Light mode" : "Dark mode");
  try { localStorage.setItem("cityscope-theme", theme); } catch { /* Private browsing may block storage. */ }
}
function setUnitsLabel() {
  if (state.primary) renderPrimary(state.primary);
  if (state.secondary) renderComparison();
}
function renderAir(data) {
  $("air-card").hidden = !state.includeAir;
  if (!state.includeAir) return;
  const air = data.air?.current;
  const index = air?.european_aqi ?? null;
  const level = airLevel(index);
  text("aqi-value", fmtNumber(index)); text("aqi-label", level.name);
  $("aqi-label").dataset.level = level.key;
  text("aqi-description", level.explanation);
  text("pm25", fmtNumber(air?.pm2_5, 1)); text("pm10", fmtNumber(air?.pm10, 1));
  const notice = $("threshold-notice");
  if (index == null) { notice.textContent = "No AQI value available for this location."; notice.dataset.watch = "missing"; }
  else if (index > state.aqiThreshold) { notice.textContent = `Watch threshold exceeded: AQI ${fmtNumber(index)} is above your chosen ${state.aqiThreshold}.`; notice.dataset.watch = "above"; }
  else { notice.textContent = `AQI ${fmtNumber(index)} is at or below your chosen watch threshold (${state.aqiThreshold}).`; notice.dataset.watch = "below"; }
}
function renderHourly(forecast) {
  const chart = $("hourly-chart"); chart.replaceChildren();
  const hourly = forecast.hourly;
  const start = Math.max(0, hourly.time.findIndex(t => t >= forecast.current.time.substring(0, 13) + ":00"));
  const points = hourly.time.slice(start, start + 12).map((time,i) => ({ time, t: hourly.temperature_2m[start+i], rain: hourly.precipitation_probability[start+i] }));
  if (!points.length) { chart.textContent = "Hourly data unavailable."; return; }
  const vals = points.map(p => p.t).filter(v => Number.isFinite(v));
  const lower = Math.min(...vals,0); const span = Math.max(1, Math.max(...vals) - lower);
  const bars = document.createElement("div"); bars.className = "chart-bars";
  const table = document.createElement("table"); table.className = "forecast-table";
  const caption = document.createElement("caption"); caption.textContent = "Temperature and rain chance for the next twelve hours, in local city time."; table.append(caption);
  const thead = document.createElement("thead"); const headRow = document.createElement("tr");
  ["Hour", "Temperature", "Rain probability"].forEach(label => { const th=document.createElement("th"); th.textContent=label; headRow.append(th); }); thead.append(headRow); table.append(thead);
  const tbody = document.createElement("tbody");
  points.forEach(point => {
    const hour = point.time.slice(11,16);
    const col = document.createElement("div"); col.className = "hour-col";
    const top = document.createElement("span"); top.className = "hour-temp"; top.textContent = temp(point.t);
    const area = document.createElement("div"); area.className = "bar-area";
    const bar = document.createElement("span"); bar.className = "bar"; bar.style.height = `${Math.max(6,((point.t - lower) / span)*100)}%`; area.append(bar);
    const label = document.createElement("span"); label.className = "hour-label"; label.textContent = hour;
    const rain = document.createElement("span"); rain.className = "rain-label"; rain.textContent = point.rain == null ? "—" : `${Math.round(point.rain)}%`;
    col.append(top,area,label,rain); bars.append(col);
    const tr = document.createElement("tr"); [hour, `${temp(point.t)} ${state.unit === "fahrenheit" ? "F" : "C"}`, `${fmtNumber(point.rain)}%`].forEach(value => { const td=document.createElement("td"); td.textContent=value; tr.append(td); }); tbody.append(tr);
  });
  table.append(tbody);
  const details = document.createElement("details"); details.className="data-table-details";
  const summary = document.createElement("summary"); summary.textContent = "View the hourly data as a table";
  const tableWrap = document.createElement("div"); tableWrap.className = "table-wrap"; tableWrap.append(table);
  details.append(summary,tableWrap); chart.append(bars,details);
  const captionEl=document.createElement("p"); captionEl.className="chart-caption"; captionEl.textContent="Showing six hours on phones and twelve on larger screens. Rain is forecast probability."; chart.append(captionEl);
}
function renderDaily(forecast) {
  const list = $("daily-list"); list.replaceChildren();
  const daily = forecast.daily; text("daily-range-label", `${daily.time.length}-day forecast`);
  daily.time.forEach((day,i) => {
    const item = document.createElement("article"); item.className = "day-card";
    const name = document.createElement("span"); name.className = "day-name";
    const weekday = new Date(`${day}T12:00:00Z`);
    name.textContent = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(weekday);
    const conditions = weatherKind(daily.weather_code?.[i]);
    const icon = document.createElement("span"); icon.className = "day-icon"; icon.setAttribute("aria-hidden","true"); icon.textContent=conditions.icon;
    const title = document.createElement("h5"); title.textContent=conditions.label;
    const temps = document.createElement("div"); temps.className="day-temps";
    const hi = document.createElement("strong"); hi.textContent=temp(daily.temperature_2m_max?.[i]);
    const lo = document.createElement("span"); lo.textContent=` / ${temp(daily.temperature_2m_min?.[i])}`; temps.append(hi,lo);
    const rain = document.createElement("p"); rain.textContent=`Rain chance: ${fmtNumber(daily.precipitation_probability_max?.[i])}%`;
    item.append(name,icon,title,temps,rain); list.append(item);
  });
}
function renderSun(data) {
  const sunriseExternal = data.sun?.sunrise;
  const sunsetExternal = data.sun?.sunset;
  const timezone = data.location.timezone;
  if (sunriseExternal && sunsetExternal) {
    text("sunrise", shortLocalTime(sunriseExternal, timezone)); text("sunset", shortLocalTime(sunsetExternal, timezone));
    text("daylight-source", "Source: Sunrise-Sunset.org · Times shown in the city's local timezone.");
  } else {
    // Use the forecast times if the daylight request fails.
    const sr = data.forecast.daily.sunrise?.[0]; const ss = data.forecast.daily.sunset?.[0];
    text("sunrise", sr ? sr.slice(11,16) : "—"); text("sunset", ss ? ss.slice(11,16) : "—");
    text("daylight-source", "Source: Open-Meteo backup · The separate daylight service is unavailable.");
  }
}
function renderPrimary(data) {
  $("dashboard").hidden = false; $("empty-state").hidden = true;
  const weather = data.forecast.current; const daily = data.forecast.daily;
  text("location-title", data.location.name); text("location-subtitle", [data.location.admin1,data.location.country].filter(Boolean).join(", "));
  text("weather-time", weather.time?.slice(11) || ""); text("updated-time", `Forecast timezone: ${data.location.timezone.replaceAll("_"," ")}`);
  text("current-temp", temp(weather.temperature_2m)); const condition=weatherKind(weather.weather_code);
  text("weather-icon", condition.icon); text("weather-description", condition.label);
  text("feels-like", `Feels like ${temp(weather.apparent_temperature)} ${state.unit === "fahrenheit" ? "F" : "C"}`);
  text("humidity", `${fmtNumber(weather.relative_humidity_2m)}%`); text("wind", `${fmtNumber(weather.wind_speed_10m)} km/h`);
  text("today-high-low", `${temp(daily.temperature_2m_max?.[0])} / ${temp(daily.temperature_2m_min?.[0])}`);
  renderAir(data); renderHourly(data.forecast); renderDaily(data.forecast); renderSun(data);
  status("dashboard-message", data.airFailed ? "Weather loaded, but the air-quality service did not respond." : "", data.airFailed ? "error" : "");
}
async function loadPrimary(loc) {
  state.primaryController?.abort(); const controller = new AbortController(); state.primaryController = controller;
  state.secondaryController?.abort(); state.secondary = null; $("compare-output").hidden = true;
  $("dashboard").setAttribute("aria-busy","true");
  status("search-message", `Loading environmental conditions for ${loc.name}…`);
  try {
    const data = await getLocationData(loc,controller.signal);
    if (controller.signal.aborted) return;
    state.primary = data; renderPrimary(data);
    status("search-message", `Loaded ${locationDisplay(loc)}.`, "success");
    text("compare-message", "Choose a second city to compare with " + loc.name + ".");
  } catch(error) {
    if (!controller.signal.aborted) status("search-message", `Unable to load ${loc.name}: ${error.message}`, "error");
  } finally { if (!controller.signal.aborted) $("dashboard").setAttribute("aria-busy","false"); }
}
function renderComparison() {
  if (!state.primary || !state.secondary) return;
  const a=state.primary; const b=state.secondary;
  $("compare-output").hidden=false;
  text("compare-a-name",`${a.location.name}, ${a.location.country || ""}`.replace(/, $/, "")); text("compare-b-name",`${b.location.name}, ${b.location.country || ""}`.replace(/, $/, ""));
  text("compare-a-temp",temp(a.forecast.current.temperature_2m)); text("compare-b-temp",temp(b.forecast.current.temperature_2m));
  const airLabel = data => data.air?.current?.european_aqi == null ? "AQI unavailable" : `European AQI ${fmtNumber(data.air.current.european_aqi)} (${airLevel(data.air.current.european_aqi).name})`;
  text("compare-a-aqi",state.includeAir?airLabel(a):"Air quality not requested"); text("compare-b-aqi",state.includeAir?airLabel(b):"Air quality not requested");
  const difference = a.forecast.current.temperature_2m - b.forecast.current.temperature_2m;
  const unit = state.unit === "fahrenheit" ? "°F" : "°C";
  const summary = Math.abs(difference)<.5 ? "Both locations currently have a similar temperature." : `${difference > 0 ? locationDisplay(a.location) : locationDisplay(b.location)} is ${Math.abs(difference).toFixed(1)}${unit} warmer right now.`;
  text("compare-summary",summary + " Weather and air quality can update at different times.");
}
async function loadSecondary(loc) {
  if (!state.primary) { status("compare-message","Load your first city above before comparing.","error"); return; }
  state.secondaryController?.abort(); const controller=new AbortController(); state.secondaryController=controller;
  status("compare-message",`Loading comparison with ${loc.name}…`);
  try {
    const data = await getLocationData(loc,controller.signal,false);
    if (controller.signal.aborted) return;
    state.secondary=data; renderComparison(); status("compare-message",`Comparison ready: ${state.primary.location.name} and ${loc.name}.`,"success");
  } catch(error) { if (!controller.signal.aborted) status("compare-message",`Comparison unavailable: ${error.message}`,"error"); }
}
async function reloadForPreferences() {
  const primaryLoc = state.primary?.location; const secondaryLoc=state.secondary?.location;
  if (!primaryLoc) return;
  await loadPrimary(primaryLoc);
  if (secondaryLoc) await loadSecondary(secondaryLoc);
}
function init() {
  let savedTheme="light";
  try { savedTheme=localStorage.getItem("cityscope-theme") || "light"; } catch { /* Optional preference */ }
  updateTheme(savedTheme === "dark" ? "dark" : "light");
  $("theme-toggle").addEventListener("click",()=>updateTheme(document.body.dataset.theme === "dark"?"light":"dark"));
  $("city-form").addEventListener("submit",event=>{
    event.preventDefault(); if (!$("city-form").reportValidity()) return;
    runSearch($("city-query").value,"primary");
  });
  $("compare-form").addEventListener("submit",event=>{
    event.preventDefault(); if (!$("compare-form").reportValidity()) return;
    if (!state.primary) { status("compare-message","Please load a primary city first.","error"); return; }
    runSearch($("compare-query").value,"compare");
  });
  $("quick-buttons").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{
    $("quick-buttons").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
    clearSearchResults("search-results"); loadPrimary(presets[button.dataset.preset]);
  }));
  document.querySelectorAll('input[name="temperature-unit"]').forEach(radio=>radio.addEventListener("change",event=>{
    if (event.target.checked) { state.unit=event.target.value; reloadForPreferences(); }
  }));
  $("forecast-days").addEventListener("change",event=>{ state.days=Number(event.target.value); reloadForPreferences(); });
  $("show-air").addEventListener("change",event=>{ state.includeAir=event.target.checked; reloadForPreferences(); });
  $("aqi-threshold").addEventListener("input",event=>{
    state.aqiThreshold=Number(event.target.value); text("threshold-value",String(state.aqiThreshold));
    if (state.primary) renderAir(state.primary);
  });
  // Show an empty state until a city has loaded.
  status("search-message","Choose a city to start exploring.");
  status("compare-message","Load your first city in the explorer before comparing.");
}
init();
