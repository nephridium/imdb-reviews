# IMDb User Reviews Scraper

Node app that retrieves user reviews from an IMDb user review page (e. g.
https://www.imdb.com/title/tt0060196/reviews), by spinning up Chrome/Puppeteer
and hitting the "Load more" button until all reviews are loaded. Then saves
the user review data into a JSON file.

## Setup

```
npm i
```

## Run

Run by supplying IMDb movie ID:

```
node index.js tt0060196
```

Run by supplying movie title

```
node index.js good bad ugly
```

This does a fuzzy match on a local mapping `imdb_movie_data.json` for the title,
it only contains a few entries. Extend the file as needed, if you need more title
lookups.
