# Content Security Policy

The YouTube IFrame API needs CSP allowances for the script and the iframe origin. Add the following directives to your CSP header (or `<meta>` policy):

```
script-src https://www.youtube.com https://s.ytimg.com
frame-src  https://www.youtube.com https://www.youtube-nocookie.com
```

## Privacy mode

If you only use `privacyMode: 'enhanced'` (no-cookie host), you can omit `https://www.youtube.com` from `frame-src`:

```
frame-src https://www.youtube.com   ← can drop this
```

## Worker / connect-src

YouTube's modern player makes ancillary network requests for analytics and stats. If your CSP also restricts `connect-src` and `img-src`, the safe minimum for embeds is:

```
connect-src https://www.youtube.com https://www.youtube-nocookie.com https://googleads.g.doubleclick.net https://static.doubleclick.net
img-src     https://i.ytimg.com data:
```

These last two aren't required for playback to start but suppress console warnings and let analytics flow normally.
