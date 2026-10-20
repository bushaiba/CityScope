# CityScope

A web app for checking weather and air quality in different cities. You can search for a place, look at the forecast and compare it with another city.

**Live site:** https://bushaiba.github.io/CityScope/

## What it does

- Search for cities worldwide, or use the quick-pick buttons
- Show current temperature, feels-like temperature, wind and humidity
- Show hourly temperatures and rain chance, plus a daily forecast
- Switch between Celsius and Fahrenheit and choose 3, 5 or 7 days
- Show European AQI, PM2.5 and PM10, with an adjustable AQI watch level
- Show sunrise and sunset for the selected city
- Compare current temperatures between two cities
- Switch between light and dark mode

The page also has loading messages and error states. Weather can still load if the air-quality or daylight service is unavailable.

## Built with

HTML, CSS and JavaScript. The styles and scripts are kept in separate files. I used CSS Grid, media queries and CSS variables for the layout. There's no front-end framework.

```text
CityScope/
  index.html
  css/styles.css
  js/app.js
  README.md
  TESTING.md
  MILESTONE.md
```

## Running it locally

Open the folder in VS Code and use Live Server, or run this from the CityScope folder:

```powershell
py -m http.server 5500
```

Then open http://localhost:5500/.

The app needs an internet connection to fetch real data. It doesn't use API keys or a backend server.

## APIs

- [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api): turns a city name into coordinates
- [Open-Meteo forecast](https://open-meteo.com/en/docs): current weather, hourly and daily forecast
- [Open-Meteo air quality](https://open-meteo.com/en/docs/air-quality-api): European AQI, PM2.5 and PM10
- [Sunrise-Sunset.org](https://sunrise-sunset.org/api): sunrise and sunset times

Weather and air-quality values are estimates from the providers, not readings from a sensor on this site. If the separate daylight API fails, the app uses sunrise/sunset from Open-Meteo and labels the source.

## Accessibility and mobile

I used semantic HTML, form labels, a skip link, visible keyboard focus and status messages for loading/results. The hourly chart also has a data table so the values aren't just shown visually.

The layout starts with mobile screens and expands for larger widths. Reduced-motion preferences are supported.

## Testing / limitations

See [TESTING.md](TESTING.md) for the browser checks and the checks still worth doing on the published site.

The automated checks used simulated API responses, so they don't prove that live providers are available at every moment. City results, weather values and API response times depend on the external services. The AQI threshold on this page is only an information setting, not a health or emergency alert.

Theme choice is stored in the browser. Search terms and coordinates are sent to the relevant API when making requests. This page doesn't keep its own database of visitor information.
