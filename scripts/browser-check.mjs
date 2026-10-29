import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=process.env.BROWSER_CDP_URL?await chromium.connectOverCDP(process.env.BROWSER_CDP_URL):await chromium.launch({headless:true,channel:'chrome'});
const context=process.env.BROWSER_CDP_URL?browser.contexts()[0]:await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
const page=context.pages()[0]||await context.newPage();await page.setViewportSize({width:1440,height:1080});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.TEST_URL || 'http://127.0.0.1:3000';
await mkdir('test-results',{recursive:true});
try {
 async function openApp(){await page.goto(url,{waitUntil:'domcontentloaded'});}
 await openApp();await page.getByRole('button',{name:'New investigation',exact:true}).waitFor();await page.getByText('INV-2026-042',{exact:false}).first().waitFor();
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 await page.getByRole('textbox',{name:'Search table'}).fill('no-such-incident');await page.getByText('No investigations found').waitFor();await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.getByRole('button',{name:'New investigation',exact:true}).click();await page.getByRole('button',{name:'Paste text',exact:true}).click();
 const unique=`Browser verification ${Date.now()}`;
 await page.getByLabel('Incident details',{exact:true}).fill(`Subject: ${unique}\nProduct: Metformin HCl\nBatch: TEST-26-9999\nDate: 2026-10-29\nContainment: Batch held for QA\nCooling flow varied during crystallization. Temperature reached 38 C.`);
 await page.getByRole('button',{name:'Extract & review',exact:true}).click();
 await page.getByLabel('Investigation title').waitFor();assert.equal(await page.getByLabel('API / product',{exact:true}).inputValue(),'Metformin HCl');await page.getByLabel('I have reviewed the imported incident details').check();
 await page.getByRole('button',{name:'Save investigation',exact:true}).click();await page.locator('.toast').filter({hasText:'saved successfully'}).waitFor();
 await page.getByRole('button',{name:'3 5 Whys'}).click();await page.getByRole('button',{name:'Suggest with assistant'}).click();await page.getByText('Review suggested investigation',{exact:false}).waitFor();await page.getByRole('button',{name:'Add for investigator review'}).click();
 await page.getByLabel('Investigator answer / hypothesis').first().waitFor();assert.equal(await page.getByLabel('Investigator answer / hypothesis').count(),5);
 assert.equal(await page.getByLabel('I have reviewed this answer against supporting evidence').first().isChecked(),false);
 await page.getByRole('button',{name:'Save investigation',exact:true}).click();await page.getByText('Investigation saved.',{exact:true}).waitFor();
 await page.screenshot({path:'test-results/investigation.png',fullPage:true});
 await page.getByRole('button',{name:'5 CAPA & review'}).click();await page.getByLabel('Investigation status').selectOption('Closed');await page.getByRole('button',{name:'Save investigation',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/Before closing/);
 await page.getByLabel('Investigation status').selectOption('In progress');await page.getByRole('button',{name:'Save investigation',exact:true}).click();await page.getByText('Investigation saved.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('textbox',{name:'Search table'}).fill(unique);await page.getByText(unique,{exact:true}).waitFor();await page.reload();await page.getByRole('textbox',{name:'Search table'}).fill(unique);await page.getByText(unique,{exact:true}).waitFor();
 await page.getByRole('button',{name:'CAPA tracker',exact:false}).first().click();await page.getByRole('heading',{name:'Corrective & preventive actions',exact:false}).waitFor();
 await page.getByRole('button',{name:'Evidence library',exact:true}).click();await page.getByRole('heading',{name:'Investigation evidence'}).waitFor();
 await page.getByRole('button',{name:'Reports',exact:true}).click();await page.getByRole('heading',{name:'Investigations by category'}).waitFor();
 await page.getByRole('button',{name:'Investigations',exact:false}).first().click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'No horizontal document overflow on mobile');
 await page.getByRole('button',{name:'New investigation',exact:true}).click();await page.getByRole('button',{name:'Enter details manually',exact:false}).click();await page.getByLabel('Investigation title').fill('Unsaved mobile test');await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByText('You have unsaved changes').waitFor();await page.getByRole('button',{name:'Discard edits'}).click();
 assert.deepEqual(errors,[]);console.log('Browser checks passed: intake, suggestions, save/reopen, closure gate, navigation, mobile overflow and unsaved edits.');
} finally {await browser.close();}
