# NFC Player

A standalone NFC-triggered player for a public exhibition audio collection.

Open the GitHub Pages site in Android Chrome and enable NFC. Write the NDEF text `fukuoka-voice-player:v1` to a compatible NFC tag. A tap plays one random recording; another tap interrupts it and selects a different recording when possible. Playback stops at the end.

The map uses [OpenStreetMap](https://www.openstreetmap.org/copyright) data for the PayPay Dome neighborhood, with the dome roof stylized as a turntable. The site does not store recording files or need operator credentials.

To regenerate the map, download the [OSM map JSON](https://api.openstreetmap.org/api/0.6/map.json?bbox=130.356,33.591,130.368,33.600) and run `node scripts/render-dome-map.mjs <downloaded-json>`. OpenStreetMap data is available under the ODbL.

Run `node --test` to check the player logic. GitHub Pages serves the `gh-pages` branch, generated with `git subtree split --prefix dist`.

When publishing changes to browser assets, bump the asset version in `dist/index.html` and `dist/main.mjs`. For immediate phone testing, share the page URL with the new version as its query string as well: a versioned entry URL bypasses a stale copy of the HTML, and versioned asset URLs bypass cached CSS, JavaScript, and SVG.
