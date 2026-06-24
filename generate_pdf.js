import fs from 'fs';
import PDFDocument from 'pdfkit';

// Create a new PDF document with A4 size and appropriate margins
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 }
});

const outputFilePath = 'e:/ASteph/Soccer Demo/Recap_Gameplay_Soccer_Demo.pdf';
doc.pipe(fs.createWriteStream(outputFilePath));

// Color palette definitions
const colors = {
  primary: '#1e3a8a',    // Dark blue
  secondary: '#0d9488',  // Teal
  text: '#334155',       // Slate grey
  lightBg: '#f8fafc',    // Light slate grey for backgrounds
  bulletColor: '#4f46e5' // Indigo for bullet points
};

// Header Banner
doc.rect(0, 0, 595.28, 110).fill(colors.primary);

// Header Title
doc.fillColor('#ffffff')
   .font('Helvetica-Bold')
   .fontSize(20)
   .text('REKAPITULASI FITUR & ROADMAP GAMEPLAY', 50, 35, { align: 'center' });

doc.moveDown(0.2);
doc.fillColor('#93c5fd')
   .font('Helvetica-Bold')
   .fontSize(11)
   .text('2D Football Match Engine v3.0', { align: 'center' });

// Reset text formatting below the header
doc.fillColor(colors.text)
   .fontSize(10);

doc.y = 140; // Set starting Y position below banner

// Helper for Section Headings
function addSectionHeading(text) {
  doc.moveDown(1.5);
  const currentY = doc.y;
  
  // Left border accent
  doc.rect(50, currentY, 4, 20).fill(colors.secondary);
  
  doc.fillColor(colors.primary)
     .font('Helvetica-Bold')
     .fontSize(14)
     .text(text, 62, currentY + 3);
  
  doc.moveDown(1.0);
}

// Helper for Subheadings
function addSubheading(text) {
  doc.moveDown(0.8);
  doc.fillColor(colors.secondary)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text(text);
  doc.moveDown(0.3);
}

// Helper for Paragraph / Body Text
function addBodyText(text, options = {}) {
  doc.fillColor(colors.text)
     .font('Helvetica')
     .fontSize(9.5)
     .text(text, { align: 'justify', lineGap: 2.5, ...options });
}

// Helper for Bullet Points
function addBullet(title, desc) {
  doc.fillColor(colors.bulletColor)
     .font('Helvetica-Bold')
     .fontSize(9.5)
     .text('  •  ' + title + ': ', { continued: true });
  
  doc.fillColor(colors.text)
     .font('Helvetica')
     .fontSize(9.5)
     .text(desc, { lineGap: 2 });
  doc.moveDown(0.3);
}

// 1. FITUR GAME SAAT INI
addSectionHeading('1. FITUR GAME SAAT INI');

addSubheading('Fisika & Pergerakan Pemain/Bola (Core Physics)');
addBullet('Sistem Vektor 2D', 'Mendeteksi posisi, jarak, kecepatan, akselerasi, pembatasan gerak, dan kalkulasi jarak dinamis antar-objek.');
addBullet('Fisika Bola', 'Bergerak dengan simulasi friksi permukaan lapangan (koefisien gesek 0.97). Saat dikuasai pemain, bola menempel di depan kaki pemain sesuai arah serang.');
addBullet('Algoritma Kemudi & Repulsi', 'Pemain mengejar target secara cerdas menggunakan steering algorithm dan didukung sistem tolak-menolak (repulsion) antar-rekan tim agar formasi tidak menumpuk di satu tempat.');

addSubheading('Sistem Waktu & Kontrol Kecepatan');
addBullet('Simulasi Waktu', 'Durasi pertandingan berjalan 90 menit (dibagi menjadi 2 babak) dengan percepatan bawaan 30x lebih cepat dibanding waktu dunia nyata.');
addBullet('Kontrol Kecepatan', 'Pengguna dibekali kontrol kecepatan jalannya simulasi pertandingan secara instan melalui tombol pilihan 1x, 2x, 5x, dan 10x.');

addSubheading('Aturan Pertandingan Realistis');
addBullet('Goal & Out-of-bounds', 'Mendeteksi gol secara akurat, lemparan ke dalam (Throw-in), tendangan gawang (Goal Kick), dan tendangan sudut (Corner Kick).');
addBullet('Sistem Offside', 'Dua linesmen memantau garis pertahanan secara aktif di sepanjang garis luar lapangan. Offside ditiup jika pemain penyerang menerima umpan di belakang bek kedua terakhir lawan di paruh lapangan lawan.');
addBullet('Sistem Pelanggaran & Kartu', 'Wasit mengevaluasi pelanggaran tekel berdasarkan tingkat keagresifan, arah tekel (seperti tekel dari belakang), tekel dua kaki, hingga wasit memberikan kartu kuning/merah. Pemain yang diusir keluar (sent off) tidak dapat digantikan.');
addBullet('Sistem Keuntungan (Advantage)', 'Wasit menunda peluit pelanggaran jika bola masih dikuasai tim yang dilanggar secara menguntungkan.');

doc.addPage(); // Page break for clean flow

addSubheading('Aturan Pertandingan Realistis (Lanjutan)');
addBullet('Pelanggaran Tangan (Handball)', 'Simulasi pelanggaran sentuhan tangan acak jika bola cepat memantul ke pemain selain GK. Menyebabkan tendangan bebas atau penalti, dan kartu merah jika menghalangi gol di garis gawang.');
addBullet('Tendangan Penalti', 'Terjadi jika pelanggaran dilakukan di dalam kotak penalti. Menggunakan mekanisme adu penalti interaktif dengan tebakan arah (kiri/kiri-atas/kanan/tengah) antara penendang gawang dan kiper.');

addSubheading('Wasit AI & VAR');
addBullet('Karakteristik Wasit', 'Wasit dihasilkan secara acak dengan tingkat ketegasan (Strictness) Lenient, Normal, atau Strict yang mempengaruhi toleransi pelanggaran dan severity tekel.');
addBullet('Sistem VAR (Video Assistant Referee)', 'Dapat dinyalakan/dimatikan. Melakukan review otomatis pada insiden Gol, Penalti, dan Kartu Merah dengan animasi visual scanline untuk mengonfirmasi atau membatalkan keputusan.');

// 2. REKAPITULASI ATRIBUT PEMAIN
addSectionHeading('2. REKAPITULASI ATRIBUT PEMAIN');
addBodyText('Setiap pemain memiliki 12 atribut dinamis (skala 1-99) yang menentukan kemampuan mereka di lapangan. Nilai default disesuaikan berdasarkan peran posisi pemain (Goalkeeper, Defender, Midfielder, Forward):');
doc.moveDown(0.5);

addBullet('Finishing (Penyelesaian)', 'Akurasi tembakan ke gawang dan tingkat kesuksesan penalti. Atribut utama untuk posisi penyerang (FWD).');
addBullet('Passing (Umpan)', 'Akurasi dan kecepatan distribusi bola ke rekan satu tim. Atribut utama untuk posisi gelandang (MID).');
addBullet('Vision (Visi)', 'Kecerdasan memilih rekan tim yang paling bebas untuk diumpan. Atribut utama untuk posisi gelandang (MID).');
addBullet('Dribbling (Giringan)', 'Kecepatan berlari saat membawa bola dan kemampuan mengontrol bola.');
addBullet('Pace (Kecepatan)', 'Kecepatan lari maksimal pemain tanpa bola. Menurun jika stamina habis.');
addBullet('Strength (Kekuatan)', 'Kemampuan memenangkan perebutan bola, merebut bola, dan menahan tekel lawan. Atribut utama bek (DEF).');
addBullet('Aggression (Agresivitas)', 'Kecenderungan melakukan tekel keras, namun meningkatkan risiko pelanggaran. Tinggi untuk bek (DEF).');
addBullet('Discipline (Disiplin)', 'Mengurangi kecenderungan mendapat kartu kuning/merah dari wasit.');
addBullet('Positioning (Penempatan Posisi)', 'Kemampuan bek menutup ruang, striker meloloskan diri dari offside, dan kiper bersiap menerima bola.');
addBullet('Composure (Ketenangan)', 'Akurasi menembak di bawah tekanan bek lawan dan ketenangan mengeksekusi penalti.');
addBullet('Stamina (Stamina)', 'Menentukan tingkat kelelahan pemain. Berkurang cepat saat berlari kencang. Membatasi Pace jika rendah.');
addBullet('Goalkeeping (Kemampuan Kiper)', 'Peluang penjaga gawang menepis tendangan lawan. Sangat tinggi untuk penjaga gawang (GK).');

doc.addPage(); // Page break for roadmap

// 3. CARA MELAKUKAN SCALE GAMEPLAY KE DEPAN
addSectionHeading('3. ROADMAP PENGEMBANGAN GAMEPLAY');

addSubheading('A. Taktik & Formasi (Tactical Depth)');
addBullet('Formasi Dinamis', 'Memungkinkan pengguna memilih formasi awal (seperti 4-4-2, 4-3-3, 3-5-2) yang langsung menyesuaikan koordinat posisi dasar.');
addBullet('Taktik Gaya Bermain', 'Menambahkan instruksi taktik tim (misalnya Tiki-Taka, Long Ball, Gegenpressing) yang mempengaruhi gaya umpan dan pressing.');
addBullet('Mentalitas Tim', 'Mengubah kecenderungan bermain (Defensive, Balanced, Attacking) untuk menaikkan atau menurunkan garis pertahanan secara instan.');
addBullet('Substitusi Pemain', 'Menyediakan bangku cadangan agar pemain yang kelelahan (stamina rendah) dapat digantikan oleh pemain segar.');

addSubheading('B. Peningkatan AI & Realisme Match Engine');
addBullet('Fisika Dimensi Ketiga (Z-Axis)', 'Menambahkan tinggi bola untuk memungkinkan umpan lambung (crossing), sundulan gawang (headers), dan tendangan voli.');
addBullet('AI Penjaga Gawang (Sweeper Keeper)', 'Memungkinkan kiper keluar dari kotak penalti untuk menyapu bola terobosan lawan.');
addBullet('Karakteristik Spesial (Traits)', 'Menambahkan trait unik seperti "Playmaker" (meningkatkan passing rekan setim) or "Speedster" (akselerasi lari sangat tinggi).');

addSubheading('C. Mode Game & Interaktivitas Pengguna');
addBullet('Interactive Manager Mode', 'Memberikan tombol instruksi langsung (seperti "Tembak!", "Oper!", "Tekan!") untuk mengarahkan permainan di momen kritis.');
addBullet('Sistem Liga & Klasemen', 'Menjalankan simulasi turnamen atau liga penuh dengan tim AI lainnya, lengkap dengan tabel klasemen dan pencetak gol terbanyak.');

addSubheading('D. Penyempurnaan Visual & Audio');
addBullet('Animasi & Sprite Arah Hadap', 'Mengganti lingkaran pemain dengan sprite beranimasi yang menunjukkan arah hadap dan pergerakan kaki.');
addBullet('Komentar Pertandingan Dinamis', 'Menyediakan teks log yang lebih dramatis dan variatif menyerupai siaran televisi nyata.');

// End and close PDF
doc.end();

console.log('PDF successfully generated at:', outputFilePath);
