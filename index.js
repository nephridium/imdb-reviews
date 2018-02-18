/* eslint-disable no-console, no-await-in-loop */
const fs = require('fs');
const puppeteer = require('puppeteer');
const FuzzySearch = require('fuzzy-search');
const movieData = require('./imdb_movie_data');

// Helpers
function jsonStr(s) {
  return JSON.stringify(s, null, 2);
}

// Parse command line parameters and try to match with an IMDb movie (ID or fuzzy title match)
const queryString = process.argv.slice(2).join(' ');
if (!queryString) {
  console.log('No parameters given. Please supply either IMDb movie ID or (partial) title.');
  process.exit(1);
}
let movie = movieData.find(movieItem => movieItem.id === queryString);

if (!movie) {
  console.log(`Parameter "${queryString}" does not match any movie ID, trying title match..`);
  const searcher = new FuzzySearch(movieData, ['title'], {
    sort: true,
  });
  const result = searcher.search(queryString);
  if (result.length > 0) {
    if (result.length > 1) {
      console.log(`More than one result, picking the first entry of:\n${jsonStr(result)}`);
    }
    [movie] = result;
  } else {
    // attempt to run the script assuming given param was a movie ID
    console.log(`Parameter "${queryString}" does not match any title, setting it as movie ID.`);
    movie = {
      id: queryString,
    };
  }
}

if (!movie.id) {
  console.log(`Could not find movie for given parameter "${queryString}".`);
  process.exit(1);
}

// Start Puppeteer scraper for given movie
console.log(`Fetching user reviews for:\n${jsonStr(movie)}`);
async function run() {
  const browser = await puppeteer.launch({ headless: false });
  const fetchDelay = 2000;
  const page = await browser.newPage();
  const url = `http://www.imdb.com/title/${movie.id}/reviews`;
  await page.goto(url);

  // Get number of reviews
  const REVIEW_NUMBER_SELECTOR = '#main > section > div.lister > div.header > div > span';
  const reviewTotal = await page.$eval(
    REVIEW_NUMBER_SELECTOR,
    $s => parseInt($s.innerText.replace(',', ''), 10),
  );

  const ITEM_SELECTOR = '.lister-item';
  const BUTTON_SELECTOR = '#load-more-trigger';

  let hasMore = true;
  while (hasMore) {
    try {
      await page.click(BUTTON_SELECTOR);
    } catch (err) {
      hasMore = false;
    }
    const reviewsLoaded = await page.$$eval(ITEM_SELECTOR, $items => $items);
    // Progress indicator; note, it looks like `reviewTotal` includes reviews that were
    // removed by staff, so we might not necessarily hit that number exactly
    console.log(`${reviewsLoaded.length} / ${reviewTotal}`);
    await page.waitFor(fetchDelay);
  }

  const data = await page.evaluate((sel) => {
    const elements = Array.from(document.querySelectorAll(sel));
    return elements.map((element) => {
      const RATINGS_SELECTOR = '.ipl-ratings-bar > span > span:nth-child(2)';
      const TITLE_SELECTOR = '.title';
      const AUTHOR_SELECTOR = 'div > div.lister-item-content > div.display-name-date ' +
        '> span.display-name-link > a';
      const TEXT_SELECTOR = 'div > div.lister-item-content > div.content > div.text';

      const ratingsBar = element.querySelector(RATINGS_SELECTOR);
      const rating = ratingsBar ? parseInt(ratingsBar.innerText, 10) : 0;
      const text = element.querySelector(TEXT_SELECTOR).innerHTML;
      return {
        date: element.querySelector('.review-date').innerText,
        author: element.querySelector(AUTHOR_SELECTOR).innerText,
        title: element.querySelector(TITLE_SELECTOR).innerText,
        rating,
        text,
      };
    });
  }, ITEM_SELECTOR);

  browser.close();

  // We're done, write review data to output file
  const filename = `./data/imdb_ratings_${movie.id}.json`;
  fs.writeFile(
    filename,
    jsonStr(data),
    (err) => {
      if (err) throw err;
      console.log(`${filename} saved`);
    },
  );
}

run();
