import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';

/**
 * Generate PDF from HTML template
 * @param {Object} invoice - Invoice data
 * @param {Object} shopSettings - Shop settings data
 * @param {String} template - Template type: 'modern', 'tally-portrait', 'tally-landscape'
 * @returns {Buffer} PDF buffer
 */
export async function generateInvoicePDF(invoice, shopSettings, template = 'modern') {
  console.log('Starting PDF generation for invoice:', invoice.invoiceNumber);

  const html = generateInvoiceHTML(invoice, shopSettings, template);

  let browser;
  try {
    console.log('Launching Puppeteer...');

    // Detect if running in serverless environment (Render, AWS Lambda, etc.)
    const isServerless = process.env.RENDER || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
      console.log('Running in serverless environment, using chromium...');
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      console.log('Running locally, using standard puppeteer...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }

    console.log('Creating new page...');
    const page = await browser.newPage();

    console.log('Setting HTML content...');
    // Use data URI to load HTML directly - much faster and no network calls
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await page.goto(dataUrl, {
      waitUntil: 'load',
      timeout: 5000
    });

    // Small delay to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

/**
 * Generate HTML for invoice based on template
 */
function generateInvoiceHTML(invoice, shopSettings, template) {
  // Use the appropriate template based on shop settings
  if (template === 'tally-portrait' || shopSettings?.invoiceTemplate === 'tally-portrait') {
    return generateTallyPortraitHTML(invoice, shopSettings);
  } else if (template === 'tally-landscape' || shopSettings?.invoiceTemplate === 'tally-landscape') {
    return generateTallyPortraitHTML(invoice, shopSettings); // Using portrait for now, can add landscape later
  } else {
    return generateModernHTML(invoice, shopSettings);
  }
}

/**
 * Generate Modern Template HTML
 */
function generateModernHTML(invoice, shopSettings) {
  const isBOS = shopSettings?.gstScheme === 'COMPOSITION';

  // For BOS/Composition: recalculate totals on-the-fly so old invoices (with GST in DB) display correctly
  const displaySubtotal = isBOS
    ? invoice.items.reduce((s, i) => s + (i.sellingPrice * i.quantity), 0)
    : invoice.subtotal;
  const discountAmt = invoice.discount || 0;
  const displayGrandTotal = isBOS
    ? Math.round(displaySubtotal - discountAmt)
    : invoice.grandTotal;

  const itemsHTML = invoice.items.map((item, index) => {
    // Recalculate totalAmount on-the-fly so old invoices (saved with GST) display correctly in BOS mode
    const itemTotal = isBOS
      ? (item.sellingPrice * item.quantity)
      : item.totalAmount;
    return `
    <tr>
      <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${index + 1}</td>
      <td style="padding: 12px 16px;">
        <div style="font-size: 14px; font-weight: 500; color: #111827;">${item.productName}</div>
        ${(item.batchNo || item.expiryDate || item.serialNumber) ? `
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
            ${item.batchNo ? `Batch: ${item.batchNo}` : ''}
            ${item.batchNo && item.expiryDate ? ' | ' : ''}
            ${item.expiryDate ? `Exp: ${new Date(item.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' })}` : ''}
            ${(item.batchNo || item.expiryDate) && item.serialNumber ? ' | ' : ''}
            ${item.serialNumber ? `S/N: ${item.serialNumber}` : ''}
          </div>
        ` : ''}
      </td>
      <td style="padding: 12px 16px; font-size: 14px; color: #111827; text-align: center;">${item.hsnCode || '-'}</td>
      <td style="padding: 12px 16px; font-size: 14px; color: #111827; text-align: center;">${item.quantity} ${item.unit}</td>
      <td style="padding: 12px 16px; font-size: 14px; color: #111827; text-align: right;">₹${item.sellingPrice.toFixed(2)}</td>
      ${!isBOS ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827; text-align: center;">${item.gstRate}%</td>` : ''}
      <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #111827; text-align: right;">₹${itemTotal.toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff;">
      <div style="background: white; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; padding: 32px; max-width: 900px; margin: 0 auto;">

        <!-- Header -->
        <div style="border-bottom: 2px solid #1f2937; padding-bottom: 24px; margin-bottom: 24px;">
          <div style="display: table; width: 100%;">
            <div style="display: table-cell; vertical-align: top;">
              <h1 style="font-size: 28px; font-weight: bold; color: #111827; margin: 0 0 8px 0;">
                ${shopSettings?.shopName || 'Business Name'}
              </h1>
              <div style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                <p style="margin: 4px 0;">${shopSettings?.address || ''}</p>
                <p style="margin: 4px 0;">${shopSettings?.city ? `${shopSettings.city}, ${shopSettings.state} - ${shopSettings.pincode}` : ''}</p>
                <p style="margin: 4px 0;">Phone: ${shopSettings?.phone || ''}</p>
                ${shopSettings?.email ? `<p style="margin: 4px 0;">Email: ${shopSettings.email}</p>` : ''}
                <p style="margin: 4px 0; font-weight: 600;">GSTIN: ${shopSettings?.gstin || ''}</p>
              </div>
            </div>
            <div style="display: table-cell; vertical-align: top; text-align: right; width: 300px;">
              <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; background-color: ${isBOS ? '#16a34a' : '#2563eb'}; color: white;">
                <p style="font-size: 14px; font-weight: 500; margin: 0;">
                  ${isBOS ? 'BILL OF SUPPLY' : 'TAX INVOICE'}
                </p>
              </div>
              <p style="margin-top: 16px; font-size: 24px; font-weight: bold; color: #111827;">${invoice.invoiceNumber}</p>
              <p style="font-size: 14px; color: #4b5563; margin-top: 4px;">
                Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <!-- Customer Details -->
        <div style="margin-bottom: 24px;">
          <div style="display: table; width: 100%;">
            <!-- Bill To -->
            <div style="display: table-cell; vertical-align: top; ${invoice.shipToName ? 'width: 50%; padding-right: 16px;' : ''}">
              <h2 style="font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase; margin-bottom: 8px;">Bill To:</h2>
              <div style="color: #111827;">
                <p style="font-weight: 600; font-size: 18px; margin: 0 0 4px 0;">${invoice.customerName}</p>
                ${invoice.customerPhone ? `<p style="font-size: 14px; margin: 4px 0;">Phone: ${invoice.customerPhone}</p>` : ''}
                ${invoice.customerAddress ? `<p style="font-size: 14px; margin: 4px 0;">${invoice.customerAddress}</p>` : ''}
                ${invoice.customerGstin ? `<p style="font-size: 14px; margin: 4px 0;">GSTIN: ${invoice.customerGstin}</p>` : ''}
              </div>
            </div>
            ${invoice.shipToName ? `
            <!-- Ship To -->
            <div style="display: table-cell; vertical-align: top; width: 50%; padding-left: 16px; border-left: 1px solid #e5e7eb;">
              <h2 style="font-size: 12px; font-weight: 600; color: #16a34a; text-transform: uppercase; margin-bottom: 8px;">Ship To:</h2>
              <div style="color: #111827;">
                <p style="font-weight: 600; font-size: 18px; margin: 0 0 4px 0;">${invoice.shipToName}</p>
                ${invoice.shipToAddress ? `<p style="font-size: 14px; margin: 4px 0;">${invoice.shipToAddress}</p>` : ''}
                ${invoice.shipToCity || invoice.shipToState || invoice.shipToPincode ? `<p style="font-size: 14px; margin: 4px 0;">${[invoice.shipToCity, invoice.shipToState, invoice.shipToPincode].filter(Boolean).join(', ')}</p>` : ''}
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        ${(invoice.poNumber || invoice.poDate || invoice.eWayBillNumber) ? `
        <div style="margin-bottom: 24px; font-size: 14px;">
          ${invoice.poNumber ? `
            <span style="color: #6b7280; font-weight: 500;">P.O. No.: </span>
            <span style="color: #111827; font-weight: 600;">${invoice.poNumber}</span>
            <span style="margin: 0 16px;"></span>
          ` : ''}
          ${invoice.poDate ? `
            <span style="color: #6b7280; font-weight: 500;">P.O. Date: </span>
            <span style="color: #111827;">${new Date(invoice.poDate).toLocaleDateString('en-IN')}</span>
            <span style="margin: 0 16px;"></span>
          ` : ''}
          ${invoice.eWayBillNumber ? `
            <span style="color: #6b7280; font-weight: 500;">e-Way Bill No.: </span>
            <span style="color: #111827; font-weight: 600;">${invoice.eWayBillNumber}</span>
          ` : ''}
        </div>
        ` : ''}

        <!-- Items Table -->
        <div style="margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="background-color: #f3f4f6; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db;">
              <tr>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">#</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">Product</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">HSN</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">Qty</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">Price</th>
                ${!isBOS ? '<th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">GST %</th>' : ''}
                <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="display: table; width: 100%; margin-bottom: 24px;">
          <div style="display: table-cell;"></div>
          <div style="display: table-cell; width: 320px; vertical-align: top;">
            <div style="font-size: 14px;">
              <div style="display: table; width: 100%; margin-bottom: 8px;">
                <div style="display: table-cell; color: #4b5563;">Subtotal:</div>
                <div style="display: table-cell; text-align: right; font-weight: 500; color: #000;">₹${displaySubtotal.toFixed(2)}</div>
              </div>
              ${!isBOS ? (invoice.taxType === 'CGST_SGST' ? `
                <div style="display: table; width: 100%; margin-bottom: 8px;">
                  <div style="display: table-cell; color: #4b5563;">CGST:</div>
                  <div style="display: table-cell; text-align: right; font-weight: 500; color: #000;">₹${invoice.totalCGST.toFixed(2)}</div>
                </div>
                <div style="display: table; width: 100%; margin-bottom: 8px;">
                  <div style="display: table-cell; color: #4b5563;">SGST:</div>
                  <div style="display: table-cell; text-align: right; font-weight: 500; color: #000;">₹${invoice.totalSGST.toFixed(2)}</div>
                </div>
              ` : `
                <div style="display: table; width: 100%; margin-bottom: 8px;">
                  <div style="display: table-cell; color: #4b5563;">IGST:</div>
                  <div style="display: table-cell; text-align: right; font-weight: 500; color: #000;">₹${invoice.totalIGST.toFixed(2)}</div>
                </div>
              `) : ''}
              ${invoice.discount > 0 ? `
                <div style="display: table; width: 100%; margin-bottom: 8px;">
                  <div style="display: table-cell; color: #4b5563;">Discount:</div>
                  <div style="display: table-cell; text-align: right; font-weight: 500; color: #000;">-₹${invoice.discount.toFixed(2)}</div>
                </div>
              ` : ''}
              ${invoice.roundOff !== 0 ? `
                <div style="display: table; width: 100%; margin-bottom: 8px;">
                  <div style="display: table-cell; color: #4b5563;">Round Off:</div>
                  <div style="display: table-cell; text-align: right; font-weight: 500; color: #000;">₹${invoice.roundOff.toFixed(2)}</div>
                </div>
              ` : ''}
              <div style="padding-top: 12px; border-top: 2px solid #1f2937; margin-top: 12px;">
                <div style="display: table; width: 100%; font-size: 18px; font-weight: bold;">
                  <div style="display: table-cell; color: #000;">Grand Total:</div>
                  <div style="display: table-cell; text-align: right; color: #000;">₹${displayGrandTotal.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style="padding-top: 8px; border-top: 1px solid #d1d5db; margin-top: 8px;">
                <div style="display: table; width: 100%;">
                  <div style="display: table-cell; color: #4b5563;">Paid Amount:</div>
                  <div style="display: table-cell; text-align: right; font-weight: 500; color: #16a34a;">₹${invoice.paidAmount.toLocaleString('en-IN')}</div>
                </div>
                ${invoice.balanceAmount > 0 ? `
                  <div style="display: table; width: 100%; margin-top: 4px;">
                    <div style="display: table-cell; color: #4b5563;">Balance Due:</div>
                    <div style="display: table-cell; text-align: right; font-weight: bold; color: #dc2626;">₹${invoice.balanceAmount.toLocaleString('en-IN')}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        ${(shopSettings?.invBankName || shopSettings?.invAccountNumber) ? `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Bank Details:</h3>
          <div style="font-size: 14px; color: #4b5563; line-height: 1.4;">
            ${shopSettings.invAccountHolder ? `<p style="margin: 2px 0;">A/C Holder: ${shopSettings.invAccountHolder}</p>` : ''}
            ${shopSettings.invBankName ? `<p style="margin: 2px 0;">Bank: ${shopSettings.invBankName}</p>` : ''}
            ${shopSettings.invAccountNumber ? `<p style="margin: 2px 0;">A/C No: ${shopSettings.invAccountNumber}</p>` : ''}
            ${shopSettings.invIfscCode ? `<p style="margin: 2px 0;">IFSC: ${shopSettings.invIfscCode}</p>` : ''}
            ${shopSettings.invBranchName ? `<p style="margin: 2px 0;">Branch: ${shopSettings.invBranchName}</p>` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Payment Info -->
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #d1d5db;">
          <div style="font-size: 14px; margin-bottom: 12px;">
            <span style="color: #4b5563;">Payment Status: </span>
            <span style="font-weight: 600; color: ${invoice.paymentStatus === 'PAID' ? '#16a34a' : invoice.paymentStatus === 'PARTIAL' ? '#ca8a04' : '#dc2626'};">
              ${invoice.paymentStatus}
            </span>
          </div>
          ${invoice.notes ? `<p style="font-size: 14px; color: #4b5563; margin-top: 12px;">Notes: ${invoice.notes}</p>` : ''}
        </div>

        ${(shopSettings?.invoiceTerms || shopSettings?.termsAndConditions) ? `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Terms & Conditions:</h3>
          <p style="font-size: 12px; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${shopSettings.invoiceTerms || shopSettings.termsAndConditions}</p>
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #d1d5db; text-align: center;">
          <p style="font-size: 14px; color: #4b5563;">Thank you for your business!</p>
          <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">
            This is a computer generated invoice and does not require signature.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate Tally Portrait Template HTML
 */
function generateTallyPortraitHTML(invoice, shopSettings) {
  const B = '1px solid #000';
  const BD = '1px dashed #bbb';

  // Number to words conversion
  function numToWords(n) {
    if (n === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const toH = (x) => {
      if (x === 0) return '';
      if (x < 20) return ones[x] + ' ';
      if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '') + ' ';
      return ones[Math.floor(x / 100)] + ' Hundred ' + toH(x % 100);
    };
    let r = '';
    const cr = Math.floor(n / 10000000);
    const lk = Math.floor((n % 10000000) / 100000);
    const th = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;
    if (cr) r += toH(cr) + 'Crore ';
    if (lk) r += toH(lk) + 'Lakh ';
    if (th) r += toH(th) + 'Thousand ';
    if (rest) r += toH(rest);
    return r.trim();
  }

  function rupeeWords(amount) {
    const rs = Math.floor(amount);
    const ps = Math.round((amount - rs) * 100);
    let w = 'Indian Rupee ' + numToWords(rs);
    if (ps > 0) w += ' and ' + numToWords(ps) + ' Paise';
    return w + ' Only';
  }

  // Check if this is a Bill of Supply (Composition Scheme - no GST)
  const isBOS = shopSettings?.gstScheme === 'COMPOSITION';
  const hasTerms = shopSettings?.invoiceTerms || shopSettings?.termsAndConditions;
  const hasBankDetails = shopSettings?.invBankName || shopSettings?.invAccountNumber;

  // For BOS/Composition: recalculate grand total from items (no GST) for backward-compat with old records
  const displaySubtotalTally = invoice.items.reduce((s, i) => s + (i.sellingPrice * i.quantity), 0);
  const displayGrandTotal = isBOS
    ? Math.round(displaySubtotalTally - (invoice.discount || 0))
    : invoice.grandTotal;

  // Build HSN-wise tax summary
  const hsnMap = {};
  invoice.items.forEach(item => {
    const key = item.hsnCode || 'N/A';
    if (!hsnMap[key]) hsnMap[key] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, rate: item.gstRate };
    const taxable = item.sellingPrice * item.quantity;
    const taxAmt = item.totalAmount - taxable;
    hsnMap[key].taxableValue += taxable;
    if (invoice.taxType === 'CGST_SGST') {
      hsnMap[key].cgst += taxAmt / 2;
      hsnMap[key].sgst += taxAmt / 2;
    } else {
      hsnMap[key].igst += taxAmt;
    }
  });
  const hsnRows = Object.entries(hsnMap);
  const totalTaxAmt = isBOS ? 0 : invoice.taxType === 'CGST_SGST'
    ? (invoice.totalCGST + invoice.totalSGST)
    : invoice.totalIGST;

  // Invoice detail rows
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '';
  const invoiceDetailRows = [
    ['Invoice No.', invoice.invoiceNumber, 'Dated', fmt(invoice.invoiceDate)],
    ['Delivery Note', invoice.deliveryNote || '', 'Mode/Terms of Payment', invoice.paymentMethod || ''],
    ['Reference No. & Date.', invoice.referenceNo || '', invoice.eWayBillNumber ? 'e-Way Bill No.' : 'Other References', invoice.eWayBillNumber ? invoice.eWayBillNumber + (invoice.otherReferences ? ` (${invoice.otherReferences})` : '') : (invoice.otherReferences || '')],
    ["Buyer's Order No.", invoice.poNumber || '', 'Dated', fmt(invoice.poDate)],
    ['Dispatch Doc No.', invoice.transportDocNumber || '', 'Delivery Note Date', fmt(invoice.transportDocDate)],
    ['Dispatched through', [invoice.transporterName, invoice.vehicleNumber].filter(Boolean).join(' | '), 'Destination', invoice.destination || invoice.pos || invoice.customerCity || ''],
  ];

  const itemsHTML = invoice.items.map((item, index) => {
    const taxable = item.sellingPrice * item.quantity;
    return `
      <tr style="border-bottom: 1px dashed #ccc;">
        <td style="border: ${B}; padding: 3px 2px; text-align: center; font-size: 10px;">${index + 1}</td>
        <td style="border: ${B}; padding: 3px 2px; font-size: 10px;">
          <div style="font-weight: bold;">${item.productName}</div>
          ${(item.batchNo || item.expiryDate || item.serialNumber) ? `
            <div style="font-size: 9px; color: #555;">
              ${item.batchNo ? `Batch: ${item.batchNo}` : ''}
              ${item.batchNo && item.expiryDate ? ' | ' : ''}
              ${item.expiryDate ? `Exp: ${new Date(item.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' })}` : ''}
              ${(item.batchNo || item.expiryDate) && item.serialNumber ? ' | ' : ''}
              ${item.serialNumber ? `S/N: ${item.serialNumber}` : ''}
            </div>
          ` : ''}
        </td>
        <td style="border: ${B}; padding: 3px 2px; text-align: center; font-size: 10px;">${item.hsnCode || ''}</td>
        <td style="border: ${B}; padding: 3px 2px; text-align: center; font-size: 10px;">${item.quantity} ${item.unit}</td>
        <td style="border: ${B}; padding: 3px 2px; text-align: right; font-size: 10px;">${item.sellingPrice.toFixed(2)}</td>
        <td style="border: ${B}; padding: 3px 2px; text-align: center; font-size: 10px;">${item.unit}</td>
        <td style="border: ${B}; padding: 3px 2px; text-align: center; font-size: 10px;"></td>
        <td style="border: ${B}; padding: 3px 2px; text-align: right; font-size: 10px;">${taxable.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const hsnRowsHTML = hsnRows.map(([hsn, d]) => `
    <tr>
      <td style="border: ${B}; padding: 2px 4px; text-align: center; font-size: 10px;">${hsn}</td>
      <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">${d.taxableValue.toFixed(2)}</td>
      ${invoice.taxType === 'CGST_SGST' ? `
        <td style="border: ${B}; padding: 2px 4px; text-align: center; font-size: 10px;">${d.rate / 2}%</td>
        <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">${d.cgst.toFixed(2)}</td>
        <td style="border: ${B}; padding: 2px 4px; text-align: center; font-size: 10px;">${d.rate / 2}%</td>
        <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">${d.sgst.toFixed(2)}</td>
      ` : `
        <td style="border: ${B}; padding: 2px 4px; text-align: center; font-size: 10px;">${d.rate}%</td>
        <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">${d.igst.toFixed(2)}</td>
      `}
      <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">
        ${invoice.taxType === 'CGST_SGST' ? (d.cgst + d.sgst).toFixed(2) : d.igst.toFixed(2)}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 0; padding: 20px;">

      <!-- Business Header -->
      <div style="text-align: left; border-bottom: ${B}; padding-bottom: 6px; margin-bottom: 0;">
        <div style="font-size: 17px; font-weight: bold;">${shopSettings?.shopName || 'Business Name'}</div>
        ${shopSettings?.address ? `<div style="font-size: 10px;">${shopSettings.address}</div>` : ''}
        <div style="font-size: 10px;">
          ${[shopSettings?.city, shopSettings?.state].filter(Boolean).join(', ')}
          ${shopSettings?.pincode ? ` - ${shopSettings.pincode}` : ''}
        </div>
        <div style="font-size: 10px;">
          ${shopSettings?.phone ? `Ph: ${shopSettings.phone}` : ''}
          ${shopSettings?.phone && shopSettings?.email ? ' | ' : ''}
          ${shopSettings?.email ? `Email: ${shopSettings.email}` : ''}
        </div>
        ${shopSettings?.gstin ? `
          <div style="font-size: 10px; font-weight: bold;">GSTIN/UIN: ${shopSettings.gstin}</div>
        ` : ''}
      </div>

      <!-- Invoice Type -->
      <div style="text-align: center; font-size: 13px; font-weight: bold; border: ${B}; border-top: none; padding: 3px; margin-bottom: 0;">
        ${isBOS ? 'BILL OF SUPPLY' : 'TAX INVOICE'}
      </div>

      <!-- Consignee / Buyer + Invoice Details -->
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr>
            <td style="width: 52%; border: ${B}; border-top: none; padding: 0; vertical-align: top;">
              <!-- Consignee -->
              <div style="padding: 4px 5px; border-bottom: ${BD};">
                <div style="font-size: 9px; color: #555; margin-bottom: 1px;">Consignee (Ship to)</div>
                <div style="font-weight: bold; font-size: 12px;">${invoice.shipToName || invoice.customerName}</div>
                ${invoice.shipToAddress || invoice.customerAddress ? `<div style="font-size: 10px;">${invoice.shipToAddress || invoice.customerAddress}</div>` : ''}
                ${invoice.shipToCity || invoice.shipToState || invoice.shipToPincode ? `<div style="font-size: 10px;">${[invoice.shipToCity, invoice.shipToState, invoice.shipToPincode].filter(Boolean).join(', ')}</div>` : ''}
                ${invoice.customerPhone ? `<div style="font-size: 10px;">Ph: ${invoice.customerPhone}</div>` : ''}
                ${invoice.customerGstin ? `
                  <div style="font-size: 10px;">GSTIN/UIN : <strong>${invoice.customerGstin}</strong></div>
                ` : `
                  <div style="font-size: 10px;">GSTIN/UIN : </div>
                `}
                <div style="font-size: 10px;">State Name : &nbsp;&nbsp;&nbsp; Code :</div>
              </div>
              <!-- Buyer -->
              <div style="padding: 4px 5px;">
                <div style="font-size: 9px; color: #555; margin-bottom: 1px;">Buyer (Bill to)</div>
                <div style="font-weight: bold; font-size: 12px;">${invoice.customerName}</div>
                ${invoice.customerAddress ? `<div style="font-size: 10px;">${invoice.customerAddress}</div>` : ''}
                ${invoice.customerPhone ? `<div style="font-size: 10px;">Ph: ${invoice.customerPhone}</div>` : ''}
                ${invoice.customerGstin ? `
                  <div style="font-size: 10px;">GSTIN/UIN : <strong>${invoice.customerGstin}</strong></div>
                ` : `
                  <div style="font-size: 10px;">GSTIN/UIN : </div>
                `}
                <div style="font-size: 10px;">State Name : &nbsp;&nbsp;&nbsp; Code :</div>
              </div>
            </td>

            <td style="width: 48%; border: ${B}; border-top: none; border-left: none; padding: 0; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  ${invoiceDetailRows.filter(([, v1, , v2]) => v1 || v2).map(([l1, v1, l2, v2]) => `
                    <tr>
                      <td style="padding: 3px 4px; border-bottom: ${BD}; color: #555; font-size: 10px; width: 28%;">${l1}</td>
                      <td style="padding: 3px 4px; border-bottom: ${BD}; border-right: ${B}; font-size: 10px; width: 22%; font-weight: ${l1 === 'Invoice No.' ? 'bold' : 'normal'};">${v1}</td>
                      <td style="padding: 3px 4px; border-bottom: ${BD}; color: #555; font-size: 10px; width: 28%;">${l2}</td>
                      <td style="padding: 3px 4px; border-bottom: ${BD}; font-size: 10px; width: 22%;">${v2}</td>
                    </tr>
                  `).join('')}
                  <tr>
                    <td style="padding: 3px 4px; color: #555; font-size: 10px;">Terms of Delivery</td>
                    <td colspan="3" style="padding: 3px 4px; font-size: 10px;">${invoice.termsOfDelivery || ''}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: center; width: 4%; font-size: 10px;">Sl<br>No.</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: left; font-size: 10px;">Description of Goods</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: center; width: 8%; font-size: 10px;">HSN/<br>SAC</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: center; width: 8%; font-size: 10px;">Quantity</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: right; width: 9%; font-size: 10px;">Rate</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: center; width: 5%; font-size: 10px;">per</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: center; width: 6%; font-size: 10px;">Disc.<br>%</th>
            <th style="border: ${B}; border-top: none; padding: 3px 2px; text-align: right; width: 12%; font-size: 10px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}

          ${!isBOS && invoice.taxType === 'CGST_SGST' ? `
            <tr>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 1px 4px; text-align: right; font-style: italic; font-weight: bold; font-size: 10px;">CGST</td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 1px 2px; text-align: right; font-size: 10px;">${(invoice.totalCGST || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 1px 4px; text-align: right; font-style: italic; font-weight: bold; font-size: 10px;">SGST</td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 1px 2px; text-align: right; font-size: 10px;">${(invoice.totalSGST || 0).toFixed(2)}</td>
            </tr>
          ` : ''}

          ${!isBOS && invoice.taxType === 'IGST' ? `
            <tr>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 1px 4px; text-align: right; font-style: italic; font-weight: bold; font-size: 10px;">IGST</td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 2px;"></td>
              <td style="border: ${B}; padding: 1px 2px; text-align: right; font-size: 10px;">${(invoice.totalIGST || 0).toFixed(2)}</td>
            </tr>
          ` : ''}

          <tr style="font-weight: bold; background-color: #f8f8f8;">
            <td colspan="3" style="border: ${B}; padding: 3px 4px; text-align: right; font-size: 10px;">Total</td>
            <td style="border: ${B}; padding: 3px 2px; text-align: center; font-size: 10px;">
              ${invoice.items.reduce((s, it) => s + it.quantity, 0)} ${invoice.items[0]?.unit || ''}
            </td>
            <td style="border: ${B}; padding: 3px 2px;"></td>
            <td style="border: ${B}; padding: 3px 2px;"></td>
            <td style="border: ${B}; padding: 3px 2px;"></td>
            <td style="border: ${B}; padding: 3px 2px; text-align: right; font-size: 10px;">
              ₹ ${displayGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Amount Chargeable in Words -->
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr>
            <td style="border: ${B}; border-top: none; padding: 2px 5px; font-size: 9px; font-style: italic; width: 70%;">
              Amount Chargeable (in words)
            </td>
            <td style="border: ${B}; border-top: none; padding: 2px 5px; font-size: 9px; font-style: italic; text-align: right;">
              E. &amp; O.E
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border: ${B}; border-top: none; padding: 3px 5px; font-weight: bold; font-size: 11px;">
              ${rupeeWords(displayGrandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      ${!isBOS ? `
      <!-- HSN/SAC Tax Summary -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: ${B}; padding: 3px 4px; text-align: center; font-size: 10px;" rowspan="2">HSN/SAC</th>
            <th style="border: ${B}; padding: 3px 4px; text-align: right; font-size: 10px;" rowspan="2">Taxable<br>Value</th>
            ${invoice.taxType === 'CGST_SGST' ? `
              <th colspan="2" style="border: ${B}; padding: 3px 4px; text-align: center; font-size: 10px;">Central Tax</th>
              <th colspan="2" style="border: ${B}; padding: 3px 4px; text-align: center; font-size: 10px;">State Tax</th>
            ` : `
              <th colspan="2" style="border: ${B}; padding: 3px 4px; text-align: center; font-size: 10px;">Integrated Tax</th>
            `}
            <th style="border: ${B}; padding: 3px 4px; text-align: right; font-size: 10px;" rowspan="2">Total<br>Tax Amt</th>
          </tr>
          <tr style="background-color: #f8f8f8;">
            <th style="border: ${B}; padding: 2px 4px; text-align: center; font-size: 9px;">Rate</th>
            <th style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 9px;">Amount</th>
            <th style="border: ${B}; padding: 2px 4px; text-align: center; font-size: 9px;">Rate</th>
            <th style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 9px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${hsnRowsHTML}

          <tr style="font-weight: bold; background-color: #f0f0f0;">
            <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">Total</td>
            <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">
              ${hsnRows.reduce((s, [, d]) => s + d.taxableValue, 0).toFixed(2)}
            </td>
            ${invoice.taxType === 'CGST_SGST' ? `
              <td style="border: ${B}; padding: 2px 4px;"></td>
              <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">
                ${hsnRows.reduce((s, [, d]) => s + d.cgst, 0).toFixed(2)}
              </td>
              <td style="border: ${B}; padding: 2px 4px;"></td>
              <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">
                ${hsnRows.reduce((s, [, d]) => s + d.sgst, 0).toFixed(2)}
              </td>
            ` : `
              <td style="border: ${B}; padding: 2px 4px;"></td>
              <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">
                ${hsnRows.reduce((s, [, d]) => s + d.igst, 0).toFixed(2)}
              </td>
            `}
            <td style="border: ${B}; padding: 2px 4px; text-align: right; font-size: 10px;">
              ${totalTaxAmt.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Tax Amount in Words -->
      <div style="border: ${B}; border-top: none; padding: 3px 5px; font-size: 10px; margin-bottom: 4px;">
        <strong>Tax Amount (In words) : </strong>${rupeeWords(totalTaxAmt)}
      </div>
      ` : ''}

      ${hasBankDetails ? `
      <!-- Bank Details -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
        <tbody>
          <tr>
            <td style="border: ${B}; padding: 5px; font-size: 10px; width: 55%; vertical-align: top;">
              <div style="font-weight: bold; margin-bottom: 2px;">Bank Details:</div>
              ${shopSettings.invAccountHolder ? `<div>A/C Holder: ${shopSettings.invAccountHolder}</div>` : ''}
              ${shopSettings.invBankName ? `<div>Bank: ${shopSettings.invBankName}</div>` : ''}
              ${shopSettings.invAccountNumber ? `<div>A/C No: ${shopSettings.invAccountNumber}</div>` : ''}
              ${shopSettings.invIfscCode ? `<div>IFSC: ${shopSettings.invIfscCode}</div>` : ''}
              ${shopSettings.invBranchName ? `<div>Branch: ${shopSettings.invBranchName}</div>` : ''}
            </td>
            <td style="border: ${B}; padding: 5px; font-size: 10px; vertical-align: top;">
              ${invoice.notes ? `<strong>Notes: </strong>${invoice.notes}` : '&nbsp;'}
            </td>
          </tr>
        </tbody>
      </table>
      ` : ''}

      ${hasTerms ? `
      <!-- Terms & Conditions -->
      <div style="border: ${B}; padding: 4px 6px; margin-bottom: 4px; font-size: 9px;">
        <div style="font-weight: bold; margin-bottom: 3px;">Terms &amp; Conditions:</div>
        <div style="white-space: pre-wrap; line-height: 1.5;">${shopSettings.invoiceTerms || shopSettings.termsAndConditions}</div>
      </div>
      ` : ''}

      <!-- Declaration + Authorised Signatory -->
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr>
            <td style="border: ${B}; padding: 5px; width: 55%; vertical-align: top; font-size: 10px;">
              <div style="font-weight: bold; margin-bottom: 3px;">Declaration</div>
              <div style="font-size: 9px; color: #333; line-height: 1.4;">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </div>
            </td>
            <td style="border: ${B}; padding: 5px; width: 45%; text-align: right; vertical-align: top; font-size: 10px;">
              <div>for <strong>${shopSettings?.shopName || ''}</strong></div>
              <div style="height: 32px;"></div>
              <div style="border-top: 1px solid #bbb; padding-top: 2px;">Authorised Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Footer -->
      <div style="text-align: center; padding: 4px 0; font-size: 10px; font-style: italic;">
        This is a Computer Generated Invoice
      </div>
    </body>
    </html>
  `;
}
