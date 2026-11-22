# NFC Web Player Implementation Plan

**Goal:** Deliver a dedicated HTTPS turntable for the exhibition tag.

**Architecture:** Static HTML/CSS, Web NFC and a Web Audio player unlocked by the enable button. The browser reads the public catalog and requests a short-lived signed URL on each tap.

- [ ] Add Node tests for marker decoding, selection, playback completion and interruption.
- [ ] Implement and test the player and public catalog adapter.
- [ ] Build the responsive turntable and wire up permission and playback states.
- [ ] Verify the public API, package the static site and deploy it privately.
- [ ] Validate physical tap behavior on Android Chrome at the exhibition.
