```
export ONE_SIGNAL_APP_ID=
export ONE_SIGNAL_REST_API_KEY=
export MIXPANEL_TOKEN=
export API_SECRET=
```

# Timezone

DOL data America time ---> Local DB (America ✓) ---> API (do nothing) ---> mobile
|
|
Cast raw DOL date to America time
|
|
Server DB (UTC ✓)
|
|
API (should correct to America time)
|
|
mobile

So need to 