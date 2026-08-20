# Review #191 — send-email apostrophe blocked Edge Function deploy

`--use-api` bundling failed on `renderShell('You're invited', …)` in
`send-email`. The apostrophe ended the string. Fixed to double quotes.
The Action now deploys `geocode-venue` and `send-email` separately so an
email parse error cannot block address lookup.

---

*End of Review #191.*
