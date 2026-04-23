import { jsPDF } from 'jspdf';
import fs from 'fs';

const doc = new jsPDF();
doc.setFontSize(22);
doc.text('PURCHASE ORDER', 20, 20);

doc.setFontSize(12);
doc.text('Order ID: PO-88392-B', 20, 30);
doc.text('Date: 22 April 2026', 20, 36);
doc.text('Delivery Deadline: 10 May 2026', 20, 42);

doc.setFontSize(14);
doc.text('ISSUED TO:', 20, 55);
doc.setFontSize(12);
doc.text('AntiFault Technologies Sdn Bhd', 20, 62);
doc.text('Suite 12-01, Menara Teknologi', 20, 68);
doc.text('Kuala Lumpur, Malaysia', 20, 74);

doc.setFontSize(14);
doc.text('BILLED TO / SHIP TO:', 100, 55);
doc.setFontSize(12);
doc.text('Kilang Pembuatan Maju Jaya Sdn. Bhd.', 100, 62);
doc.text('No. 8, Jalan Industri 4,', 100, 68);
doc.text('Kawasan Perindustrian Bayan Lepas,', 100, 74);
doc.text('11900 Bayan Lepas, Penang, Malaysia', 100, 80);
doc.text('Attn: Mr. Ahmad Razali', 100, 86);

doc.setFontSize(14);
doc.text('ORDER DETAILS:', 20, 105);

doc.setFontSize(12);
doc.text('1. Vibration Analysis Sensor Node (Model: VA-200)', 20, 115);
doc.text('   10 units x RM 1,250.00 = RM 12,500.00', 20, 121);

doc.text('2. Edge Computing Gateway (Industrial Grade)', 20, 131);
doc.text('   2 units x RM 4,500.00 = RM 9,000.00', 20, 137);

doc.text('3. Annual Predictive Maintenance Platform License', 20, 147);
doc.text('   1 year x RM 15,000.00 = RM 15,000.00', 20, 153);

doc.setFontSize(14);
doc.text('FINANCIAL SUMMARY:', 20, 170);
doc.setFontSize(12);
doc.text('Subtotal: RM 36,500.00', 20, 178);
doc.text('SST (8%): RM 2,920.00', 20, 184);
doc.setFont("helvetica", "bold");
doc.text('Grand Total: RM 39,420.00', 20, 192);

doc.setFont("helvetica", "normal");
doc.setFontSize(14);
doc.text('NOTES & INSTRUCTIONS:', 20, 210);
doc.setFontSize(10);
doc.text('1. All hardware must be pre-calibrated prior to delivery.', 20, 218);
doc.text('2. Please include the PO number (PO-88392-B) on all invoices and delivery orders.', 20, 224);
doc.text('3. Delivery strictly between 9:00 AM - 4:00 PM (Monday - Friday).', 20, 230);
doc.text('4. Contact Site Engineer (En. Hafiz) 24 hours prior to dispatch.', 20, 236);

doc.setFontSize(12);
doc.text('AUTHORIZED BY:', 20, 260);
doc.setFont("helvetica", "italic");
doc.text('Computer Generated Document - No Signature Required', 20, 266);

fs.writeFileSync('PO-88392-B.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('PDF generated: PO-88392-B.pdf');
