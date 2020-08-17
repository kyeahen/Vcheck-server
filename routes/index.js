var express = require('express');
var router = express.Router();

var config = require('./config.js');
var multer  = require('multer');
var AWS = require('aws-sdk');
var fs = require('fs-extra');
var mysql = require('mysql');
const async = require('async');

//파일을 저장할 경로 지정
var upload = multer({ dest: './uploads' });

//config.js에서 작성한 리전 정보를 설정합니다.
AWS.config.region = config.region;
var rekognition = new AWS.Rekognition(
	{
		region: config.region
	}
);

//POST - Rekognition을 이용한 상품 분석 API
router.post('/api/rekognition', upload.single("image"), function (req, res, next) {
	//클라이언트와 통신 시, 받아온 이미지 데이터를 변수로 저장합니다.
	var bitmap = fs.readFileSync(req.file.path);

	/* deteceText는 이미지내의 텍스트를 감지하는 메소드 입니다.
	Rekognition에서 제공됩니다.*/
	rekognition.detectText({
		//Rekognition에 전송할 요청 바디입니다.
	 	"Image": { 
			 //우리가 전송한 이미지 데이터를 value 값으로 넣어줍니다.
	 		"Bytes": bitmap,
		 }
	}, function(err, data) {
	 	if (err) { //통신 실패
	 		res.send(err);
	 	} else { //통신 성공

			/* 올바른 사진 분석을 하지 못했을 시 (텍스트를 감지 못한 경우)에는 TextDetections 값이 빈 배열로 오게 됩니다. 
			그럴 시에 클라이언트에게 올바를 에러 처리를 할 수 있도록 아래와 같은 결과를 반환하도록 하였습니다.
			*/
			if(data.TextDetections && data.TextDetections.length > 0)
			{	
				var textData = data.TextDetections;
				var textList = [];
				
				for(var i = 0; i < textData.length; i++){
					if (data.TextDetections[i].DetectedText) {
						textList[i] = data.TextDetections[i].DetectedText
					}
				}

				var uniq = textList.reduce(function(a,b){
					if (a.indexOf(b) < 0 ) a.push(b);
					return a;
				  },[]);

		        getLabels(uniq, res)

			} else {
				var errorText = {
					food_name : "none",
					brand_name : "none"
				};

				//텍스트 인식 값이 없을 시에는 임의로 none 값을 반환했습니다.
				res.json(errorText)
			}
		}
  });
});

var getLabels = function(data,res) {

	var connection = mysql.createConnection({
		host     : '입력하세요',    // RDS 엔드포인트 (RDS 생성 후, 얻을 수 있습니다.)
		user     : '입력하세요',    // Master username (RDS 생성 시, 설정한 정보입니다.)
		password : '입력하세요',    // 마스터 암호 (RDS 생성 시, 설정한 정보입니다.)
		database : '입력하세요'     // mysql 데이터베이스 이름
	});

	connection.connect();

	for (var i = 0; i < data.length; i++) {

		//해당 데이터베이스에서 클라이언트에게 받은 food_name, brand_name 값에 알맞은 상품을 검색합니다.
		connection.query("SELECT food_name, brand_name FROM food_list WHERE text = ?", data[i], 
		function (err, data) {
			if(err) {
				console.log(err);
			} else{
				if (data.length > 0) {
					result1 = data[0].food_name;
					result2 = data[0].brand_name;

					var correctText = {
						food_name : result1,
						brand_name : result2
					};
	
					res.json(correctText)
				} 
			} 
		});
	}
}
module.exports = router;

