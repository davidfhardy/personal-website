# Personal Website

David Hardy's personal website: plain HTML, CSS and vanilla JavaScript. No frameworks, no build
step, so it works on GitHub Pages as-is (and straight from `file://`).

## Preview locally

- **VS Code:** right-click `index.html` → **Open with Live Server** (port 5500).
- **Terminal:** `python3 -m http.server 5501`, then open <http://localhost:5501>.

## Structure

```
index.html            Home: hero, about, links
cv.html               CV (Education, Experience, Teaching, Awards, Affiliations, Activities)
publications.html     Journal papers, conference papers, patents
photography.html      Portfolio gallery + trip cards
trips/japan.html      Trip galleries (pages in trips/ use ../ paths)
trips/colombia.html
css/style.css         All styles. Colours, fonts and sizes are CSS custom properties in :root
js/main.js            Navbar scroll state, mobile menu, CV section highlighting
js/gallery.js         Justified photo galleries + lightbox
js/photos.js          Photo data for every gallery (edit this to add photos)
images/placeholders/  Generated placeholder images (delete once real photos are in)
scripts/              Helper scripts (see below)
favicon.svg           "DH" monogram
.nojekyll             Tells GitHub Pages to serve files as-is
```

The header and footer are duplicated in each HTML file (so pages work without JavaScript). If
you change the nav or footer, update all six pages.

## Deploying to GitHub Pages

Push the repo to GitHub, then go to **Settings → Pages → Build and deployment**, pick
**Deploy from a branch**, and choose `main` / `(root)`. All paths are relative, so it works both
as a user site (`https://<username>.github.io/`) and as a project site
(`https://<username>.github.io/personal-website/`).

## Adding photos

Galleries are driven by data. Each page has an empty container like

```html
<div class="gallery" data-gallery="japan" data-section="0"></div>
```

and `js/gallery.js` fills it from `window.PHOTO_DATA` in `js/photos.js`:

```js
window.PHOTO_DATA = {
  portfolio: [/* photos */], // a plain list
  japan: {
    // a trip with sections
    title: "Japan",
    subtitle: "Tokyo, Osaka, Kyoto, Nara (May 2023)",
    sections: [
      { name: "Tokyo", photos: [/* photos */] }, // data-section="0"
      { name: "Osaka and Nara", photos: [/* … */] }, // data-section="1"
    ],
  },
};
```

Each photo looks like this:

```js
{ src: "images/japan/kyoto/IMG_0012.jpg",          // full size, for the lightbox
  thumb: "images/japan/kyoto/thumbs/IMG_0012.jpg", // optional, smaller, for the grid
  width: 2000, height: 1333,                       // real pixel size (the ratio sets the layout)
  alt: "Fushimi Inari torii gates at dusk",        // describe the photo
  caption: "Fushimi Inari, Kyoto" }                // optional, shown in the lightbox
```

Paths are relative to the **site root**, even for pages in `trips/` (`gallery.js` resolves
them).

### 1. Make web-sized copies (macOS, built-in `sips`)

Full-resolution camera files are too big for the web. This makes a 2000 px (long edge) version
for the lightbox and an 800 px thumbnail for the grid, both as JPEG at quality 80:

```bash
./scripts/resize-photos.sh ~/Pictures/Exports/Kyoto images/japan/kyoto
```

You can also run the underlying commands yourself:

```bash
sips -s format jpeg -s formatOptions 80 -Z 2000 in.jpg --out images/japan/kyoto/in.jpg
sips -s format jpeg -s formatOptions 80 -Z 800  in.jpg --out images/japan/kyoto/thumbs/in.jpg
```

(Location metadata is kept by `sips`. Export without GPS data if you don't want it public.)

### 2. Generate the data entries

```bash
node scripts/build-photo-list.mjs images/japan/kyoto --label "Kyoto"
```

This reads each image's size with `sips -g pixelWidth -g pixelHeight` and prints a JSON array
(with `thumb` filled in automatically when `thumbs/` exists). Paste it over the matching
`photos: [ … ]` list in `js/photos.js`, then improve the `alt` text.

### 3. Adding a whole new trip

1. Resize the photos into `images/<trip>/` (or `images/<trip>/<section>/`).
2. Add a new key to `js/photos.js`, e.g. `halifax: { title, subtitle, sections: [{ name: "", photos: [...] }] }`.
3. Copy `trips/colombia.html` to `trips/halifax.html` and change the title, subtitle, meta
   description and `data-gallery="halifax"`.
4. On `photography.html`, turn the "Coming soon" Halifax `<div class="trip-card trip-card--soon">`
   into `<a class="trip-card" href="trips/halifax.html">` and remove the "Coming soon" tag.
5. Run `node scripts/check-links.mjs` to catch typos in paths.

### Lightbox deep links

`trips/japan.html?open=3` opens photo 3 of the first gallery on the page;
`trips/japan.html?open=5&section=2` opens photo 5 of the Kyoto section.

## Scripts (Node, no npm dependencies)

| Script                                         | What it does                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `scripts/resize-photos.sh SRC DEST`            | Web-sized JPEGs + thumbnails with `sips` (macOS)                           |
| `scripts/build-photo-list.mjs DIR --label X`   | Prints `photos.js` entries with width/height (macOS)                       |
| `scripts/check-links.mjs`                      | Checks internal links, anchors, asset paths and photo paths                |
| `scripts/make-placeholders.mjs [--write-data]` | Regenerates placeholder SVGs; `--write-data` **overwrites** `js/photos.js` |

## Still to do

- Replace the hero image (`css/style.css` → `.hero` `background-image`), the headshot
  (`index.html`), the trip covers (`photography.html`) and all gallery placeholders.
- Choose the portfolio photos (`portfolio` in `js/photos.js`).
- Once the final URL is known, add absolute `og:url` / `og:image` tags (see the TODO in each
  page's `<head>`).
- Confirm the CV items marked with HTML comments in `cv.html`.
