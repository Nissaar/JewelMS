import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const RESULTS_PATH = path.join(process.cwd(), 'playwright-report/results.json');
const OUTPUT_PDF_PATH = path.join(process.cwd(), 'playwright-report/e2e-test-report.pdf');

function generatePDFReport() {
  console.log('Generating E2E Test PDF Report...');

  if (!fs.existsSync(RESULTS_PATH)) {
    console.error(`Error: Playwright results JSON not found at ${RESULTS_PATH}. Please run tests first.`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(RESULTS_PATH, 'utf8');
  const reportData = JSON.parse(rawData);

  // Initialize PDF
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    bufferPages: true
  });

  const writeStream = fs.createWriteStream(OUTPUT_PDF_PATH);
  doc.pipe(writeStream);

  // Colors
  const colors = {
    primary: '#0f172a',    // Deep slate
    secondary: '#f59e0b',  // Gold/amber
    success: '#10b981',    // Emerald
    failure: '#ef4444',    // Rose
    neutralLight: '#f8fafc', // Light gray background
    border: '#e2e8f0',     // Light slate border
    textDark: '#1e293b',   // Dark slate text
    textLight: '#64748b'   // Slate gray text
  };

  // --- COVER PAGE ---
  doc.rect(0, 0, doc.page.width, 15).fill(colors.primary);

  doc.moveDown(4);
  doc.fontSize(28).fillColor(colors.primary).font('Helvetica-Bold').text('HAUJEE JEWELLERY', { align: 'center' });
  doc.fontSize(16).fillColor(colors.secondary).font('Helvetica-Bold').text('End-to-End E2E Test Report', { align: 'center' });
  
  doc.moveDown(1.5);
  doc.rect(40, doc.y, doc.page.width - 80, 2).fill(colors.border);
  doc.moveDown(1.5);

  // Summary Metrics
  const stats = reportData.stats || {
    startTime: new Date().toISOString(),
    duration: 0,
    numExpectedResults: 0,
    numFailed: 0,
    numPassed: 0,
    numSkipped: 0
  };

  const totalTests = stats.numFailed + stats.numPassed + stats.numSkipped;
  const startTimeFormatted = new Date(stats.startTime).toLocaleString('fr-FR', { timeZone: 'UTC' });
  const durationSecs = (stats.duration / 1000).toFixed(1);

  // Draw Dashboard Panel
  const panelY = doc.y;
  doc.rect(40, panelY, doc.page.width - 80, 100).fill(colors.neutralLight);
  doc.rect(40, panelY, doc.page.width - 80, 100).stroke(colors.border);

  doc.fontSize(11).fillColor(colors.textLight).font('Helvetica-Bold');
  doc.text('RUN METADATA', 60, panelY + 15);
  doc.fontSize(10).fillColor(colors.textDark).font('Helvetica');
  doc.text(`Date & Time: ${startTimeFormatted}`, 60, panelY + 35);
  doc.text(`Environment: Local / CI Production Build`, 60, panelY + 50);
  doc.text(`Total Duration: ${durationSecs} seconds`, 60, panelY + 65);

  // Statistics
  const startX = doc.page.width - 240;
  doc.fontSize(11).fillColor(colors.textLight).font('Helvetica-Bold');
  doc.text('STATISTICS', startX, panelY + 15);

  doc.fontSize(10).fillColor(colors.textDark).font('Helvetica');
  doc.text(`Total Executed:`, startX, panelY + 35);
  doc.font('Helvetica-Bold').text(`${totalTests}`, startX + 110, panelY + 35);

  doc.font('Helvetica').text(`Passed:`, startX, panelY + 50);
  doc.font('Helvetica-Bold').fillColor(colors.success).text(`${stats.numPassed}`, startX + 110, panelY + 50);

  doc.font('Helvetica').fillColor(colors.textDark).text(`Failed:`, startX, panelY + 65);
  doc.font('Helvetica-Bold').fillColor(stats.numFailed > 0 ? colors.failure : colors.textDark).text(`${stats.numFailed}`, startX + 110, panelY + 65);

  doc.font('Helvetica').fillColor(colors.textDark).text(`Skipped:`, startX, panelY + 80);
  doc.font('Helvetica-Bold').fillColor(colors.textLight).text(`${stats.numSkipped}`, startX + 110, panelY + 80);

  doc.moveDown(6);

  // --- DETAILS SECTION ---
  doc.fontSize(16).fillColor(colors.primary).font('Helvetica-Bold').text('Detailed Test Log', 40);
  doc.moveDown(0.5);

  // Traverse tests
  let specIndex = 1;
  const suites = reportData.suites || [];

  function processSuite(suite, parentName = '') {
    const suiteName = parentName ? `${parentName} > ${suite.title}` : suite.title;

    if (suite.specs) {
      for (const spec of suite.specs) {
        const specTitle = spec.title;
        const testFile = path.basename(spec.file || '');
        
        for (const testRun of spec.tests || []) {
          for (const result of testRun.results || []) {
            // Check page height limit to prevent overflow before writing spec header
            if (doc.y > doc.page.height - 180) {
              doc.addPage();
            }

            const isPassed = result.status === 'passed';
            const statusText = isPassed ? 'PASSED' : result.status.toUpperCase();
            const statusColor = isPassed ? colors.success : (result.status === 'failed' ? colors.failure : colors.textLight);
            
            // Draw header bar
            doc.rect(40, doc.y, doc.page.width - 80, 24).fill(colors.neutralLight);
            doc.rect(40, doc.y - 24, doc.page.width - 80, 24).stroke(colors.border);
            
            doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary);
            doc.text(`${specIndex}. [${testFile}] ${specTitle}`, 50, doc.y - 17, { width: doc.page.width - 200 });

            doc.fontSize(9).font('Helvetica-Bold').fillColor(statusColor);
            doc.text(statusText, doc.page.width - 120, doc.y - 17, { align: 'right', width: 70 });

            doc.moveDown(0.5);

            doc.fontSize(9).font('Helvetica').fillColor(colors.textLight);
            doc.text(`Duration: ${(result.duration / 1000).toFixed(2)}s`, 50);
            
            if (result.error) {
              doc.moveDown(0.5);
              doc.fontSize(8).font('Courier').fillColor(colors.failure);
              const cleanErr = result.error.message ? result.error.message.replace(/\u001b\[\d+m/g, '') : JSON.stringify(result.error);
              doc.text(`Error: ${cleanErr}`, 50, doc.y, { width: doc.page.width - 100 });
            }

            doc.moveDown(1);

            // Handle screenshots if present
            if (result.attachments && result.attachments.length > 0) {
              const screenshots = result.attachments.filter(att => att.name === 'screenshot' || att.contentType?.startsWith('image/'));
              
              for (const screenshot of screenshots) {
                const imgPath = screenshot.path;
                if (fs.existsSync(imgPath)) {
                  // Reserve space for screenshot. If it doesn't fit, add a page.
                  const imageHeight = 230;
                  if (doc.y > doc.page.height - (imageHeight + 40)) {
                    doc.addPage();
                  }

                  doc.fontSize(9).font('Helvetica-Oblique').fillColor(colors.textLight);
                  doc.text(`Step Screenshot:`, 50, doc.y);
                  doc.moveDown(0.3);

                  try {
                    doc.image(imgPath, 50, doc.y, { width: doc.page.width - 100, height: imageHeight });
                    doc.y += imageHeight + 15;
                  } catch (imgErr) {
                    doc.fontSize(8).font('Helvetica').fillColor(colors.failure);
                    doc.text(`[Error rendering screenshot: ${imgErr.message}]`, 50);
                    doc.moveDown(1);
                  }
                }
              }
            }

            specIndex++;
          }
        }
      }
    }

    if (suite.suites) {
      for (const subSuite of suite.suites) {
        processSuite(subSuite, suiteName);
      }
    }
  }

  for (const suite of suites) {
    processSuite(suite);
  }

  // Add Page Numbers and Footer
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    // Header (skip on page 0)
    if (i > 0) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.textLight);
      doc.text('HAUJEE JEWELLERY - E2E TEST REPORT', 40, 20);
      doc.rect(40, 32, doc.page.width - 80, 0.5).fill(colors.border);
    }

    // Footer
    doc.rect(40, doc.page.height - 35, doc.page.width - 80, 0.5).fill(colors.border);
    doc.fontSize(8).font('Helvetica').fillColor(colors.textLight);
    doc.text(`Generated automatically by Playwright CI pipeline`, 40, doc.page.height - 25);
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - 100, doc.page.height - 25, { align: 'right' });
  }

  doc.end();

  writeStream.on('finish', () => {
    console.log(`Success! PDF test report created at: ${OUTPUT_PDF_PATH}`);
  });
}

generatePDFReport();
