"use strict";
// API reference: https://open-meteo.com/en/docs/geocoding-api
const locations = {
  Manchester:{name:"Manchester",country:"United Kingdom",latitude:53.4808,longitude:-2.2426,timezone:"Europe/London"},
  Dubai:{name:"Dubai",country:"United Arab Emirates",latitude:25.2048,longitude:55.2708,timezone:"Asia/Dubai"},
  Tokyo:{name:"Tokyo",country:"Japan",latitude:35.6762,longitude:139.6503,timezone:"Asia/Tokyo"},
  Nairobi:{name:"Nairobi",country:"Kenya",latitude:-1.2864,longitude:36.8172,timezone:"Africa/Nairobi"},
  Sydney:{name:"Sydney",country:"Australia",latitude:-33.8688,longitude:151.2093,timezone:"Australia/Sydney"}
};
const byId = id => document.getElementById(id);
let primary = null;
let secondary = null;
let requestController = null;
const getUnit = () => document.querySelector('input[name="unit"]:checked')?.value || "celsius";
const getDays = () => Number(byId("days")?.value || 3);
function setStatus(message, error=false, target="status") { const element=byId(target); element.textContent=message; element.dataset.error=String(error); }
async function getJson(url, signal) {
  const response=await fetch(url,{signal,headers:{Accept:"application/json"}});
  if(!response.ok) throw new Error(`Service returned HTTP ${response.status}`);
  const result=await response.json();
  if(result.error) throw new Error(result.reason || "API reported an error");
  return result;
}
const labelOf = loc => [loc.name,loc.admin1,loc.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
async function findCities(query,area="results",statusTarget="status",choose=choosePrimary) {
  const resultArea=byId(area); resultArea.replaceChildren();
  setStatus("Searching for matching cities…",false,statusTarget);
  try {
    const args=new URLSearchParams({name:query.trim(),count:"6",language:"en",format:"json"});
    const data=await getJson(`https://geocoding-api.open-meteo.com/v1/search?${args}`);
    const options=(data.results||[]).filter(c=>typeof c.latitude==="number" && typeof c.longitude==="number");
    if(!options.length){setStatus("No matching cities found.",true,statusTarget);return;}
    options.forEach(loc=>{
      const button=document.createElement("button"); button.type="button";button.textContent=labelOf(loc);
      button.addEventListener("click",()=>{resultArea.replaceChildren();choose(loc);});
      resultArea.append(button);
    });
    setStatus("Choose a city from the results.",false,statusTarget);
  } catch(error) {setStatus(`Search failed: ${error.message}`,true,statusTarget);}
}
byId("city-form").addEventListener("submit",event=>{event.preventDefault();if(event.target.reportValidity())findCities(byId("city-query").value);});
byId("quick-buttons").querySelectorAll("button").forEach(button=>{
  button.addEventListener("click",()=>choosePrimary(locations[button.dataset.city]));
});
function weatherUrl(loc){
  const args=new URLSearchParams({latitude:loc.latitude,longitude:loc.longitude,current:"temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m",hourly:"temperature_2m,precipitation_probability",daily:"temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",temperature_unit:getUnit(),forecast_days:String(getDays()),timezone:"auto"});
  return `https://api.open-meteo.com/v1/forecast?${args}`;
}
async function fetchPrimary(loc, signal) {
  const base=await getJson(weatherUrl(loc),signal);
  const airArgs=new URLSearchParams({latitude:loc.latitude,longitude:loc.longitude,current:"european_aqi,pm2_5,pm10",timezone:"auto"});
  const sunArgs=new URLSearchParams({lat:loc.latitude,lng:loc.longitude,formatted:"0"});
  const [aqi,daylight]=await Promise.allSettled([
    byId("include-air").checked ? getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${airArgs}`,signal) : Promise.resolve(null),
    getJson(`https://api.sunrise-sunset.org/json?${sunArgs}`,signal)
  ]);
  return {weather:base,air:aqi.status==="fulfilled"?aqi.value:null,sun:daylight.status==="fulfilled"?daylight.value:null};
}
function renderExtra(){
  const visible=byId("include-air").checked;byId("air-panel").hidden=!visible;
  if(visible){const a=primary.air?.current;const value=a?.european_aqi;
    byId("aqi").textContent=value==null?"Unavailable":String(value);
    byId("pm25").textContent=a?.pm2_5 ?? "—";byId("pm10").textContent=a?.pm10 ?? "—";
    const threshold=Number(byId("threshold").value);
    byId("threshold-label").textContent=String(threshold);
    byId("aqi-note").textContent=value==null?"Air-quality service unavailable.":value>threshold?`AQI above your watch threshold of ${threshold}.`:`AQI at or below ${threshold}.`;
  }
  const sun=primary.sun?.results;
  const daily=primary.weather.daily;
  const zone=primary.weather.timezone||primary.location.timezone||"UTC";
  const format=value=>{try{return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:zone}).format(new Date(value));}catch{return "—";}};
  const fallback=iso=>iso?.slice(11,16)||"—";
  byId("sunrise").textContent=sun?.sunrise?format(sun.sunrise):fallback(daily.sunrise?.[0]);
  byId("sunset").textContent=sun?.sunset?format(sun.sunset):fallback(daily.sunset?.[0]);
  byId("daylight-note").textContent=sun?"Source: Sunrise-Sunset.org":"Fallback: Open-Meteo";
}
byId("include-air").addEventListener("change",reload);
byId("threshold").addEventListener("input",()=>{if(primary)renderExtra();else byId("threshold-label").textContent=byId("threshold").value;});
async function loadPrimary(loc){
  requestController?.abort();requestController=new AbortController();
  byId("selected-city").textContent=`Loading ${labelOf(loc)}…`;
  setStatus("Retrieving current weather…");
  try {
    const data=await fetchPrimary(loc,requestController.signal);
    if(requestController.signal.aborted) return;
    primary={location:loc,...data};renderPrimary();
    setStatus(`Loaded ${loc.name}.`);
  } catch(error) {if(!requestController.signal.aborted)setStatus(`Unable to load weather: ${error.message}`,true);}
}
function choosePrimary(loc){loadPrimary(loc);}
function renderPrimary(){
  const w=primary.weather.current;
  byId("selected-city").textContent=labelOf(primary.location);
  byId("weather-output").hidden=false;
  byId("temperature").textContent=`${Math.round(w.temperature_2m)}°`;
  byId("humidity").textContent=`${w.relative_humidity_2m}%`;
  byId("wind").textContent=`${w.wind_speed_10m} km/h`;
  byId("feels-like").textContent=`Feels like ${Math.round(w.apparent_temperature)}°`;
  renderForecast();
  renderExtra();
}
function renderForecast(){
  const daily=primary.weather.daily;const list=byId("daily-list");list.replaceChildren();
  daily.time.forEach((day,i)=>{
    const card=document.createElement("div");card.className="forecast-day";
    const label=document.createElement("span");label.textContent=day;
    const temp=document.createElement("strong");temp.textContent=`${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°`;
    const rain=document.createElement("small");rain.textContent=`Rain probability: ${daily.precipitation_probability_max[i]}%`;
    card.append(label,temp,rain);list.append(card);
  });
  const hourly=primary.weather.hourly;const list2=byId("hourly-list");list2.replaceChildren();
  hourly.time.slice(0,12).forEach((hour,i)=>{
    const tile=document.createElement("div");tile.className="hourly-item";
    const time=document.createElement("div");time.textContent=hour.slice(11);
    const temp=document.createElement("strong");temp.textContent=`${Math.round(hourly.temperature_2m[i])}°`;
    const rain=document.createElement("small");rain.textContent=`${hourly.precipitation_probability[i]}% rain`;
    tile.append(time,temp,rain);list2.append(tile);
  });
  byId("forecast").hidden=false;
}
function reload(){if(primary)loadPrimary(primary.location);}
document.querySelectorAll('input[name="unit"]').forEach(el=>el.addEventListener("change",reload));
byId("days").addEventListener("change",reload);
function chooseSecondary(loc){loadSecondary(loc);}
async function loadSecondary(loc){
  setStatus("Loading comparison data…",false,"compare-status");
  try {
    const args=new URLSearchParams({latitude:loc.latitude,longitude:loc.longitude,current:"temperature_2m",temperature_unit:getUnit(),timezone:"auto"});
    const weather=await getJson(`https://api.open-meteo.com/v1/forecast?${args}`);
    secondary={location:loc,weather};renderCompare();setStatus("Comparison ready.",false,"compare-status");
  } catch(error){setStatus(`Comparison failed: ${error.message}`,true,"compare-status");}
}
function renderCompare(){
  if(!primary || !secondary)return;
  byId("compare-output").hidden=false;
  byId("compare-a").textContent=labelOf(primary.location);
  byId("compare-b").textContent=labelOf(secondary.location);
  const a=primary.weather.current.temperature_2m;
  const b=secondary.weather.current.temperature_2m;
  byId("compare-a-temp").textContent=`${Math.round(a)}°`;
  byId("compare-b-temp").textContent=`${Math.round(b)}°`;
  byId("compare-summary").textContent=`Current temperature difference: ${Math.abs(a-b).toFixed(1)}°.`;
}
byId("compare-form").addEventListener("submit",event=>{
  event.preventDefault();if(!event.target.reportValidity())return;
  if(!primary){setStatus("Load a primary city first.",true,"compare-status");return;}
  findCities(byId("compare-query").value,"compare-results","compare-status",chooseSecondary);
});
function applyTheme(theme){document.body.dataset.theme=theme;
  byId("theme-toggle").setAttribute("aria-pressed",String(theme==="dark"));
  byId("theme-toggle").textContent=theme==="dark"?"Light mode":"Dark mode";
  try{localStorage.setItem("cityscope-theme",theme);}catch{/* Optional */}
}
let saved="light";try{saved=localStorage.getItem("cityscope-theme")||"light";}catch{/* Optional */}
applyTheme(saved);
byId("theme-toggle").addEventListener("click",()=>applyTheme(document.body.dataset.theme==="dark"?"light":"dark"));
document.querySelectorAll('input[name="unit"]').forEach(input=>input.addEventListener('change',()=>{secondary=null;byId('compare-output').hidden=true;}));
