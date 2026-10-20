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
async function fetchPrimary(loc, signal) {
  const args=new URLSearchParams({latitude:loc.latitude,longitude:loc.longitude,current:"temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m",timezone:"auto"});
  return {weather:await getJson(`https://api.open-meteo.com/v1/forecast?${args}`,signal)};
}
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
}
