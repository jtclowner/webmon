const puppeteer = require('puppeteer-extra')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
const { convertCSVToArray } = require('convert-csv-to-array');
const fs = require('fs');
const looksSame = require('looks-same');
const Promise = require('bluebird');
const path = require('path');
puppeteer.use(AdblockerPlugin())

const values = [
	'This site can’t be reached',
	'Search results for',
	'The Sponsored Listings',
	'courtesy of GoDaddy.com.',
	'The domain name',
	'Future home of',
	'404.',
	'is available for sale!',
	'GitHub pages site here.',
	'401 Authorization Required',
	'This Account has been suspended.',
	'This domain name is parked FREE',
	'Parked on the Bun',
    'Too many requests'
];

const parallel = 2;


const contentChecker = async (browser, page) => {
    const matches = await page.evaluate((strings) => {
		const text = document.body.innerText;
		return strings.filter(string => text.includes(string));
    }, values);
    if (matches != "") {
		console.log('Found the text: "' + matches + '" so lets skip this page.');
		throw 'Content does not match blacklist';
	}
};

const convertArrayToObject = async (domainsArray) => {
	let emptyArray = [];
	await domainsArray.forEach(async domain => {
		filename = await parseUrl(domain);
		const domainObject = { name: filename, url: 'http://' + domain }
		emptyArray.push(domainObject);
	});
	return emptyArray;
}

const parseUrl = async (httpUrl) => {
	let parsedUrl = httpUrl.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '');
	if (parsedUrl.endsWith('/')) {
		parsedUrl = parsedUrl.slice(0, -1);
	}
	return parsedUrl;
}

const screenshotDomains = async (domains, parallel) => {
    const parallelBatches = Math.ceil(domains.length / parallel)
    console.log('\nI have gotten the task of taking screenshots of ' + domains.length + ' domains and will take ' + parallel + ' of them at a time.')
    console.log(' This will result in ' + parallelBatches + ' batches.')
  
    // Split up the Array of domains
    let k = 0
    for (let i = 0; i < domains.length; i += parallel) {
		k++
		console.log('\nBatch ' + k + ' of ' + parallelBatches)
		// Launch and Setup Chromium
		const browser = await puppeteer.launch();
		// Fun with puppeteer
		const context = await browser.createIncognitoBrowserContext();
		const page = await context.newPage();
		page.setJavaScriptEnabled(false);
  
		const promises = [];
		for (let j = 0; j < parallel; j++) {
			const elem = i + j;
			// only proceed if there is an element
			if (domains[elem] !== undefined) {
				// Promise to take Screenshots
				// promises push
				const name = domains[elem].name;
				console.log('Trying to browse to: ' + name);
				promises.push(browser.newPage().then(async page => {
				await page.setViewport({ width: 1280, height: 800 });
					try {
						// Only create screenshot if page.goto get's no error
						await page.goto(domains[elem].url, {
							waitUntil: ['networkidle0', 'domcontentloaded']
						});
						await contentChecker(browser, page);
						const directoryPath = `./snapshots/${name}.png`;
						const tempDirectoryPath = `./temp/${name}.png`;
						const newDirectoryPath = `./output/${name}.png`;
						if (fs.existsSync(directoryPath)) {
							// Snapshot exists for this domain already
							await page.screenshot({ path: tempDirectoryPath, fullPage: true }).then(console.log('Taking a screenshot of ' + name));
							await handleIfExists(name, directoryPath, tempDirectoryPath, newDirectoryPath);
						} else {
							// I should create a new snapshot
							await handleIfDoesNotExist(directoryPath, newDirectoryPath, page);
						}
					} catch (err) {
						console.log(name + ` is a 404 or parked domain, let's skip it`);
					}
				})
			)
		}
	}
	// await promise all and close browser
	await Promise.all(promises)
	await browser.close()
	console.log('\nI finished this batch. I\'m ready for the next batch')
    }
}

const deleteFile = (path) => { 
    fs.unlink(path, () => { // delete temp if they match
        console.log(`I deleted ${path}`);
    })
};


const handleIfDoesNotExist = async (parsedUrlPath, newParsedPath, page) => {
    console.log(`generating snapshot for ${parsedUrlPath}`);
    await page.screenshot({path: parsedUrlPath, fullPage: true }); 
	fs.copyFile(parsedUrlPath, newParsedPath, 2, () => {});
}

const handleIfExists = async (parsedUrl, parsedPath, tempPath, newPath) => {
	await Promise.delay(500);
    await looksSame(parsedPath, tempPath, {tolerance:9, ignoreAntialiasing: true}, function(error, {equal}) {
		// console.log('equal:', equal); // do these screenshots look identical?
        if (equal) {
            console.log(`${parsedUrl} looks the same as it was before`);
            deleteFile(tempPath);
        } else { // temp and parsed are not the same
			console.log('parsedPath:', parsedPath);
			console.log('tempPath:', tempPath);
            console.log(`${parsedUrl} looks different!`);
            fs.copyFile(tempPath, parsedPath, 2, () => {}); //copy temp to snapshot
            fs.rename(tempPath, newPath, () => {});   // put in 'new' folder to check
        }
    })
}

const main = async (domains, parallel) => {
	const arrayOfDomains = await convertArrayToObject(domains);
	await checkDirectories();
	screenshotDomains(arrayOfDomains, parallel);
}

// Create temp, snapshot and output directories
const checkDirectories = () => {
	fs.existsSync('./output') ? '' : fs.mkdir(path.join(__dirname, './output'), () => {}); 
	fs.existsSync('./output/trash') ? '' : fs.mkdir(path.join(__dirname, './output/trash'), () => {}); 
	fs.existsSync('./snapshots') ? '' : fs.mkdir(path.join(__dirname, './snapshots'), () => {});
	fs.existsSync('./temp') ? '' : fs.mkdir(path.join(__dirname, './temp'), () => {});
}

// Get list of URLS from .csv file
const data = fs.readFileSync('./urls.csv', 'utf8', (err, data) => {});
const domains = convertCSVToArray(data, {separator: ','});
console.log('Domains to check: ' + domains[0]);

main(domains[0], parallel);