# CityScope testing

## Browser checks completed

These were tested in Chromium with simulated API replies. That checks the UI behaviour, not whether an external provider is online.

- City search and quick-pick buttons: pass
- Current weather, hourly/daily forecast and air quality display: pass
- Temperature units and forecast length: pass
- AQI slider and show/hide air-quality option: pass
- Second-city comparison: pass
- Light/dark mode: pass
- Failed air-quality/daylight requests don't stop the weather panel: pass
- JavaScript console in the tested flows: no errors
- Layout at 320, 375, 768 and 1440px: no page-wide horizontal overflow

## Checks on the live GitHub Pages site

Tick these after testing the real published site:

- [ ] Search for Paris and choose the correct result
- [ ] Load Manchester, Dubai and Tokyo using real API data
- [ ] Change units and forecast duration
- [ ] Compare two places and check the displayed difference
- [ ] Change the AQI watch level and hide/show the air card
- [ ] Expand the hourly data table on mobile
- [ ] Check sunrise/sunset and the source message
- [ ] Use keyboard only (Tab, Shift+Tab, Enter and Space)
- [ ] Test the skip link and visible focus
- [ ] Check narrow mobile, tablet and desktop layouts
- [ ] Try an offline/failed request and check the error message
- [ ] Run an accessibility check (WAVE or axe) and review the findings

## Known limits

- The app depends on external services, which may be slow or unavailable.
- Forecasts and air-quality numbers are modelled estimates.
- The air-quality scale is European AQI even when looking at cities outside Europe.
- Comparison values may have slightly different observation/update times.
- The AQI watch setting is not a health warning service.
