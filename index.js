//var http = require('http');
//var server = http.createServer(function(req, res) {
//    res.writeHead(200, {'Content-Type': 'text/plain'});
//    var message = 'It works!\n',
//        version = 'NodeJS ' + process.versions.node + '\n',
//        response = [message, version].join('\n');
//    res.end(response);
//});
//server.listen();

//Tahap Pertama
///Ini Page index.js
const express=require('express');
const app=express();
const path=require('path');
const connectionKeKolam = require('./db_koneksi');
const bodyParser= require('body-parser');
const cookieParser = require("cookie-parser");
const session = require('express-session');
const port=3500;
//const { format } = require('./db_koneksi');
//const { timeStamp } = require('console');


app.set('view engine','ejs');

app.listen(port,()=>{
    console.log('Sistem Presensi Pegawai v1.0.0 berjalan pada server Localhost di port 3500');
});

exports.executeQuery=function(query,callback){
    connectionKeKolam.getConnection(function(err,connection){
        if (err) {
          connection.release();
          throw err;
          console.log('Sistem Presensi Pegawai v1.0.0 Sudah Terhubung ke DBMS MySQL', res);
        }   
        connection.query(query,function(err,rows){
            connection.release();
            if(!err) {
                callback(null, {rows: rows});
            }           
        });
        connection.on('error', function(err) {      
              throw err;
              return;     
        });
    });
};

//connectionKeKolam.connect((err, res)=>{
//    if (err) throw err;
//  console.log('Sistem Presensi Pegawai v1.0.0 Sudah Terhubung ke DBMS MySQL', res);
//});
const oneDay = 1000 * 60 * 60 * 24;//cookie dalam waktu 24 jam 
const oneMonth = 1000 * 60 * 60 * 24 * 30;//cookie dalam waktu sebulan
const oneYear = 1000 * 60 * 60 * 24 * 30  * 12;//cookie dalam waktu setahun

app.use(cookieParser());

app.use(session({
	secret: ['secret','veryimportantsecret','notsoimportantsecret','highlyprobablysecret','thisismysecrctekeyfhrgfgrfrty84fwir767'],
	name: "secretname",
	resave: false,
	saveUninitialized: true,
	cookie:{ maxAge: oneYear }// Session kadaluarsa setelah 1 Tahun
}));

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));

app.use(express.static(__dirname+'public'));

app.get('/user',(req,res)=>{
    //return  res.render('presensimasuk');
    return res.redirect('/user/beranda');
});

app.get('/user/beranda',(req, res)=>{
    if (req.session.loggedin){
        return  res.render('berandapresensi',{ idpegawai:req.session.idpegawai });
    } 
        return res.redirect('/user/login');
        
});

app.get('/user/login',(req,res)=>{
    return res.render('loginpresensi');
})

app.post('/user/login', (req, res)=>{
    const idpegawai = req.body.idpegawai;
    const sandi = req.body.sandi;
    if (idpegawai && sandi) {
    connectionKeKolam.query(
        `SELECT * FROM pegawai WHERE idpegawai="${idpegawai}" AND sandi="${sandi}"`, (err, results) =>{
            if (err) throw err;
            if(results.length){
                console.log('Anda berhasil Login dengan idpegawai='+idpegawai);
                req.session.loggedin = true;
                req.session.idpegawai = idpegawai;
                return res.redirect('/user/beranda');
                
            } else {
                console.log('Maaf Anda gagal Login dengan idpegawai='+idpegawai);
                return res.redirect('/user/login');
            }
        }
    )
    }
});

app.get('/user/logout',(req,res)=>{
    req.session.destroy();
    res.redirect('/user/login');
    console.log('Anda berhasil Logout');
});

//Tahap Kedua
//-------------------------------------------------Bagian Presensi Masuk Awal--------------------------------

app.get('/user/presensimasuk/:idpegawai',(req, res)=>{
    if (!req.session.loggedin) return res.redirect('/user');
     req.body.idpegawai = req.session.idpegawai;
    connectionKeKolam.query(`SELECT pegawai.idpegawai, pegawai.namapegawai, pegawai.jabatanpegawai FROM pegawai WHERE idpegawai="${req.session.idpegawai}"`, (err, results) => {
        if(err) throw err
        const pegawaiData = results.filter(function(pegawai) {return pegawai.idpegawai === req.session.idpegawai} );
        connectionKeKolam.query(`SELECT * FROM pengaturan`, (err,resultsData)=> {
            if (err) throw err    
            return res.render('presensimasuk',{ idpegawai:req.session.idpegawai, pegawai: results, pegawaiData : pegawaiData[0], pengaturanData: resultsData[0] });
        });
    });
});

const autoidpresensimasuk = function () {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const tjam = now.getHours().toString().padStart(2, '0');
    const tmenit = now.getMinutes().toString().padStart(2, '0');
    const tsekon = now.getSeconds().toString().padStart(2, '0');
    const tmsekon = now.getMilliseconds().toString().padStart(2,'0');
    return `PRESMA-${tmsekon}${tsekon}${tmenit}${tjam}${day}${month}${now.getFullYear()}`;
};


const tglwaktumasuk = function() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const tjam = now.getHours().toString().padStart(2, '0');
    const tmenit = now.getMinutes().toString().padStart(2, '0');
    const tsekon = now.getSeconds().toString().padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day} ${tjam}:${tmenit}:${tsekon}`;
};

app.post('/user/addpresensimasuk', (req, res)=>{
    const idpresensi = autoidpresensimasuk();
    const idpegawai = req.session.idpegawai;
    const tglwaktu = tglwaktumasuk();
    const longitude = req.body.longitude;
    const latitude = req.body.latitude;
    const jenispresensi = "MASUK";
    const sistemkerja = req.body.sistemkerja;
    const foto = req.body.foto;
    connectionKeKolam.query(
        `INSERT INTO presensi (idpresensi,idpegawai,tglwaktu,longitude,latitude,jenis_presensi,sistem_kerja,foto) VALUES ("${idpresensi}","${idpegawai}","${tglwaktu}","${longitude}","${latitude}","${jenispresensi}","${sistemkerja}","${foto}")`, (err, results) =>{
            if (err) throw err;
            if(results.length=1){
                console.log('Input Presensi Masuk Berhasil dengan idpegawai='+idpegawai);
                res.redirect('/user/beranda');
            } else {
                console.log('Input Presensi Masuk Gagal dengan idpegawai='+idpegawai);
               res.redirect('/user/presensimasuk');
            }
        }
    );
});

//-------------------------------------------------Bagian Presensi Masuk Akhir--------------------------------



//Tahap Ketiga
//-------------------------------------------------Bagian Presensi Keluar Awal-----------------------------
app.get('/user/presensikeluar/:idpegawai',(req, res)=>{
    if (!req.session.loggedin) return res.redirect('/user');
     req.body.idpegawai = req.session.idpegawai;
    connectionKeKolam.query(`SELECT pegawai.idpegawai, namapegawai,jabatanpegawai FROM pegawai WHERE idpegawai="${req.session.idpegawai}"`, (err, results) => {
        if(err) throw err
        const pegawaiData = results.filter(function(pegawai) {return pegawai.idpegawai === req.session.idpegawai});
        connectionKeKolam.query(`SELECT * FROM pengaturan`, (err,resultsData)=> {
            if (err) throw err 
            return res.render('presensikeluar',{ idpegawai:req.session.idpegawai, pegawai: results, pegawaiData : pegawaiData[0], pengaturanData: resultsData[0] });
        });
    });
});

const autoidpresensikeluar = function () {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const tjam = now.getHours().toString().padStart(2, '0');
    const tmenit = now.getMinutes().toString().padStart(2, '0');
    const tsekon = now.getSeconds().toString().padStart(2, '0');
    const tmsekon = now.getMilliseconds().toString().padStart(2,'0');
    return `PRESPU-${tmsekon}${tsekon}${tmenit}${tjam}${day}${month}${now.getFullYear()}`;
};


const tglwaktukeluar = function() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const tjam = now.getHours().toString().padStart(2, '0');
    const tmenit = now.getMinutes().toString().padStart(2, '0');
    const tsekon = now.getSeconds().toString().padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day} ${tjam}:${tmenit}:${tsekon}`;
};

app.post('/user/addpresensikeluar', (req, res)=>{
    const idpresensi = autoidpresensikeluar();
    const idpegawai = req.session.idpegawai;
    const tglwaktu = tglwaktukeluar();
    const longitude = req.body.longitude;
    const latitude = req.body.latitude;
    const jenispresensi = "KELUAR";
    const sistemkerja = req.body.sistemkerja;
    const foto = req.body.foto;
    connectionKeKolam.query(
        `INSERT INTO presensi (idpresensi,idpegawai,tglwaktu,longitude,latitude,jenis_presensi,sistem_kerja,foto) VALUES ("${idpresensi}","${idpegawai}","${tglwaktu}","${longitude}","${latitude}","${jenispresensi}","${sistemkerja}","${foto}")`, (err, results) =>{
            if (err) throw err;
            if(results.length=1){
                console.log('Input Presensi Keluar Berhasil dengan idpegawai='+idpegawai);
                res.redirect('/user/beranda');
            } else {
                console.log('Input Presensi Keluar Gagal dengan idpegawai='+idpegawai);
                res.redirect('/user/presensikeluar');
            }
        }
    );
});


//-------------------------------------------------Bagian Presensi Keluar Akhir-----------------------------


//Tahap Keempat
//-------------------------------------------------Bagian Log Presensi Awal-----------------------------

const logtglwaktu = function() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

app.get('/user/logpresensimasuk/:idpegawai',(req, res)=>{
    const lapwaktuin = logtglwaktu();
    if (!req.session.loggedin) return res.redirect('/user');
    req.body.idpegawai = req.session.idpegawai;
    connectionKeKolam.query(`SELECT * FROM pegawai JOIN presensi ON pegawai.idpegawai=presensi.idpegawai WHERE presensi.jenis_presensi="MASUK" AND pegawai.idpegawai="${req.session.idpegawai}" AND (presensi.tglwaktu>="${lapwaktuin} 00:00:00" AND presensi.tglwaktu<="${lapwaktuin} 23:59:59")`, (err, results) => {
       if(err) throw err
       res.render('presensilogmasuk', { idpegawai:req.session.idpegawai, logpresensimasukData: results, logpresensimasukDataDetail: {} });
    });
});

app.get('/user/logpresensikeluar/:idpegawai',(req, res)=>{
    const lapwaktuout = logtglwaktu();
    if (!req.session.loggedin) return res.redirect('/user');
    req.body.idpegawai = req.session.idpegawai;
    connectionKeKolam.query(`SELECT * FROM pegawai JOIN presensi ON pegawai.idpegawai=presensi.idpegawai WHERE presensi.jenis_presensi="KELUAR" AND pegawai.idpegawai="${req.session.idpegawai}" AND (presensi.tglwaktu>="${lapwaktuout} 00:00:00" AND presensi.tglwaktu<="${lapwaktuout} 23:59:59")`, (err, results) => {
      if(err) throw err
       res.render('presensilogkeluar', { idpegawai:req.session.idpegawai, logpresensikeluarData: results, logpresensikeluarDataDetail: {} });
    });
});

//-------------------------------------------------Bagian Log Presensi Akhir-----------------------------


//Tahap Kelima



