var FileAPI = require('file-api')
	, File = FileAPI.File
  , FileList = FileAPI.FileList
  , FileReader = FileAPI.FileReader;
const fs = require('fs')

const CMP_Speed_Normal = 1;
const CMP_Speed_Fast = 0;

var colorTable = [];
var pixelTable = [];
var valueTable = [];
var alphaValueTable = [];
var alphaLookupTable = [];
var g_blockCount = 65280;
var g_width = 128;
var g_height = 128;
var hasMipmaps = false;
var mipmapCount = 0;
var blockPosition = 0;
var frameCount = 1;
var frames = [];
var currFrame = 0;
var imagesLoaded = 0;
var singleImageAnim = false;
var mipmaps = [0];
var converted = false;
var g_outputType = 13;
var outputImage = [];
var g_shortened = false;
var colorSqrt = false;
var forceDither = false;
var lumaPow = false;
var colorDifference = 0;
//var cresizer = document.createElement('canvas');
var mipmapclick = false;
var outdxt;
var onImportClipAccept;
var largestResolution = 1024;
var autores = false;

var field_filename = ''

//var fastSeekEnabled = typeof document.createElement('video').fastSeek != "undefined";
//setResolution();
function setResolution(cb) {
	//setOutputType(document.getElementById('format'));
	colorTable = [];
	pixelTable = [];
	valueTable = [];
	alphaValueTable = [];
	alphaLookupTable = [];
	g_blockCount = 65280;
	mipmapCount = 0;
	blockPosition = 0;
	currFrame = 0;
	imagesLoaded = 0;
	converted = false;
	outputImage = [];
	g_shortened = false;
	autores = false;
	while (autores && getEstFileSize(false)/1024 > 513 && g_width >= 8 && g_height >= 8){
		g_width /=2;
		g_height/=2;
		check();
	}
	check();
	cb()
}

function check() {
	if (getEstFileSize(false)/1024 >= 512 && getEstFileSize(false)/1024 < 513){
		g_shortened = true;
	}
	else if (g_shortened && getEstFileSize(false)/1024 < ((g_width - 4) / g_width) * 512 - 1){
		g_shortened = false;
	}

	reducedMipmaps = getEstFileSize(false)/1024 >= 384;
	//showMipmap(document.getElementById("mipmapsCheck"));
}

// setInterval(function(){
// 	if (frameCount > 1 && (imagesLoaded == frameCount || singleImageAnim)) {
// 		//console.log("ffd")
		
// 		if (++currFrame >= frameCount)
// 			currFrame = 0;
// 			var mipwidth = g_width;
// 			var mipheight = g_height;
// 		for(var i = 0; i <= mipmapCount; i++) {
			
// 			generatePreview(i, mipwidth, mipheight);
// 			mipwidth /= 2;
// 			mipheight /= 2;
// 		}
// 	}
// 	var filesize = getEstFileSize(true)/1024;
// 	if (filesize < 512)
// 		document.getElementById('filesizee').innerHTML = "Estimated file size: <span style='color:green'>"+filesize+"</span> [KB]";
// 	else
// 		document.getElementById('filesizee').innerHTML = "Estimated file size: <span style='color:red'>"+filesize+"</span> [KB]";

// }, 200);

function handleFileSelect(files, cb) {
	var files = files; // FileList object
	if (files.length == 0)
		return;
//	document.getElementById('convertButton').disabled = true;
//	document.getElementById('saveButton').disabled = true;
//	document.getElementById('files0').disabled = true;
	
	imagesLoaded = 0;
	frames = [];
	frames[0] = [];
	currFrame = 0;
	frameCount = files.length;
	for (var i = 0; i < files.length; i++ ) {
		if (files[i] && files[i].type.match('image.*')) {
			var reader = new FileReader();
			// Closure to capture the file information.
			reader.fileIndex = i;
			reader.fileType = files[i].type;
			
			reader.onload = (function(e) {
					//console.log(this.fileType);
					var img = new Image();

					img.src = e.target.result;
	
					img.onload = function () {
						imagesLoaded += 1;
						frames[0].push(img);
						if (imagesLoaded == frameCount) {
							updateHighestResolution(img.g_width, img.g_height,frameCount);
							check();
						}
					}
					
					
				});
			reader.readAsDataURL(files[i]);
			
		}
	}

	cb()
	//mipmaps[0].getContext("2d").clearRect(0,0,g_width,g_height);
}

function setSingleFrame() {
	if (singleImageAnim && frames[0]) {
		frameCount = frames[0].g_height / g_height;
	}
	else {
		frameCount = frames.length;
	}
}

function getFrameRows() {
	return Math.min(frameCount,Math.floor(32767/g_height));
}

function getFrameColumns() {
	return Math.ceil(frameCount * g_height / 32767);
}

function convert() {
	blockPosition = 0;
	g_blockCount = 0;
	convertPixels(0, g_width, getTotalImageHeight());
	converted = true;

	//generatePreview(0,g_width, g_height);
}



function changeMipmap(evt,mipmapNumber) { // this code, it scares me
	var files = evt.target.files; // FileList object
	if (files.length == 0)
		return;
	var mipimages = 0;
	var cwidth = g_width/(Math.pow(2,mipmapNumber));
	var cheight = g_height/(Math.pow(2,mipmapNumber));
	frames[mipmapNumber] = [];
	for (var i = 0; i < files.length && i < imagesLoaded; i++ ) {
		if (files[i] && files[i].type.match('image.*')) {
			var reader = new FileReader();
			// Closure to capture the file information.
			reader.fileType = files[i].type;
			reader.onload = (function(e) {
					var img = new Image();
						
					img.src = e.target.result;
					img.onload = function () {
						frames[mipmapNumber].push(img);
						mipimages++;
						if (mipimages == Math.min(imagesLoaded, files.length)) {
							loadMipmaps(mipmapNumber, cwidth, cheight);
						}
					}
				});
			reader.readAsDataURL(files[i]);
		}
	}
}


function convertPixels(canvas, fwidth, fheight) {
	if (g_shortened)
		fwidth = fwidth - 4;
	
	
	blockPosition = 0;
	var isdxt = g_outputType == 13 || g_outputType == 15;
	var origpixels = fwidth*fheight;
	var outimg;
	if (isdxt) {
		outimg = new Int32Array(Math.ceil(fwidth/4)*4*Math.ceil(fheight/4)*4/ (g_outputType == 13 ? 8 : 4));
		fwidth = Math.ceil(fwidth/4)*4;
		fheight = Math.ceil(fheight/4)*4;
		g_blockCount += Math.ceil(fwidth/4)*Math.ceil(fheight/4);
	}
	for (var d = 0; d< getFrameColumns(); d++){
		// if (getFrameColumns() > 1)
		// 	var pix = mipmaps[canvas].getContext("2d").getImageData(mipmaps[canvas].g_width/2/getFrameColumns() - fwidth/2+d*fwidth, 0, fwidth, d == getFrameColumns() -1 ? (frameCount%getFrameRows())*g_height : getFrameRows()*g_height);
		// else
		// 	var pix = mipmaps[canvas].getContext("2d").getImageData(mipmaps[canvas].g_width/2 - fwidth/2+d*fwidth, 0, fwidth, fheight);
		if (isdxt) {

			var quality = 2 //0: fast - 1: normal - 2: slow - 3: very slow
			m_nRefinementSteps = quality;
			m_nRefinementStepsAlpha = quality+1;
			m_b3DRefinement = quality == 3;
			m_bUseAdaptiveWeighting = quality > 1;
			m_nCompressionSpeed = quality == 0 ? CMP_Speed_Fast : CMP_Speed_Normal;
			m_nCompressionSpeedAlpha = quality == 1 ? CMP_Speed_Fast : CMP_Speed_Normal;
			if (quality == 3)
				m_nRefinementSteps -=1;

			var bufsrc = new Int32Array(16);
			var bufprv = new Uint8Array(64);
			var bufsrcalpha = new Uint8Array(16);
			var bufout = new Int32Array(2);
			
			valueTable[canvas] = outimg;
			var position = 0;
			
			const pix_height = 128
			for (var j=0; j<pix_height/4; j++) { // rows of blocks
				for (var i=0; i<fwidth/4; i++) { // columns of blocks
				//g_blockCount+=1;
				for (var y = 0; y < 4; y++){
					for (var x = 0; x < 4; x++){
						position = x*4+(16*i)+(fwidth*16*j)+(fwidth*4*y);
						bufsrc[x+y*4]=(pix.data[position+3]<<24)+(pix.data[position]<<16)+(pix.data[position+1]<<8)+pix.data[position+2];
					}
				}
				if (g_outputType == 15) {
					for (var y = 0; y < 4; y++){
						for (var x = 0; x < 4; x++){
							position = x*4+(16*i)+(fwidth*16*j)+(fwidth*4*y);
							bufsrcalpha[x+y*4]=pix.data[position+3];
						}
					}
					CompressAlphaBlock(bufsrcalpha,bufout,bufprv);
					outimg.set(bufout,blockPosition);
					blockPosition+=2;
				}
				CompressRGBBlock(bufsrc,bufout,CalculateColourWeightings(bufsrc), g_outputType==13, g_outputType==13, 127,bufprv)
					for (var y = 0; y < 4; y++){
						for (var x = 0; x < 4; x+=1){
							position = x*4+(16*i)+(fwidth*16*j)+(fwidth*4*y);
							pix.data[position]=bufprv[(x+y*4)*4+2];
							pix.data[position+1]=bufprv[(x+y*4)*4+1];
							pix.data[position+2]=bufprv[(x+y*4)*4];
							pix.data[position+3]=bufprv[(x+y*4)*4+3];
						}
					}
				outimg.set(bufout,blockPosition);
				blockPosition+=2;
				}
			}
		}
		// else if(g_outputType == 0) {
		// 	outputImage[canvas] = pix.data;
		// }
		// else if (g_outputType == 2) {
		// 	for (var i = 0; i < pix.data.length; i += 4){
		// 		pix.data[i+3] = 255;
		// 	}
		// 	outputImage[canvas] = pix.data;
		// }
		// else if(g_outputType == 4) {
		// 	for (var i = 0; i < pix.data.length; i += 4){
		// 		pix.data[i+3] = 255;
		// 	}
		// 	//reduceColors(pix, 5, 6, 5, 8, document.getElementById('ditherCheck').checked);
		// 	outputImage[canvas] = pix.data;
		// }
		// else if(g_outputType == 21) {
		// 	//reduceColors(pix, 5, 5, 5, 1, document.getElementById('ditherCheck').checked);
		// 	outputImage[canvas] = pix.data;
		// }
		// else if(g_outputType == 19) {
		// 	//reduceColors(pix, 4, 4, 4, 4, document.getElementById('ditherCheck').checked);
		// 	outputImage[canvas] = pix.data;
		// }
	}
	mipmaps[canvas].getContext("2d").putImageData(pix,mipmaps[canvas].g_width/2 - fwidth/2,0);
}

//Utils
function getEstFileSize(cmipmaps) {
	var mult = 1;
	if (g_outputType == 0){
		mult = 4;
	}
	else if (g_outputType == 13){
		mult = 0.5;
	}
	else if (g_outputType == 2){
		mult = 3;
	}
	else if (g_outputType == 4 || g_outputType == 21 || g_outputType == 19){
		mult = 2;
	}
	// if (cmipmaps && document.getElementById("mipmapsCheck").checked) {
	// 	mult *= 1.33203125;
	// }
	return (g_shortened ? g_width - 4 : g_width) * getTotalImageHeight() * mult + 64;
}

function getTotalImageHeight() {
	return g_height * frameCount;
}

function getHueDiff(hue1, hue2){
	return 180 - Math.abs(Math.abs(hue1 - hue2) - 180);
}

function getHue(red, green, blue){
	var min = Math.min(Math.min(red, green),blue);
	var max = Math.max(Math.max(red, green),blue);
	if (min == max)
		return 0;
	
	if (max == red){
		hue = (green - blue)/(max - min);
	}
	else if (max == green){
		hue = 2 + (blue - red)/(max - min);
	}
	else if (max == blue){
		hue = 4 + (red - green)/(max - min);
	}
	hue *= 60;
	return hue;
}

function restoreAlpha(alpha1, alpha2, num){
	if (alpha1 > alpha2)
	switch(num){
		case 0: return alpha1;
		case 1: return alpha2;
		case 2: return (6 * alpha1 + 1 * alpha2) / 7;
		case 3: return (5 * alpha1 + 2 * alpha2) / 7;
		case 4: return (4 * alpha1 + 3 * alpha2) / 7;
		case 5: return (3 * alpha1 + 4 * alpha2) / 7;
		case 6: return (2 * alpha1 + 5 * alpha2) / 7;
		case 7: return (1 * alpha1 + 6 * alpha2) / 7;
	}
	else
	switch (num) {
		case 0: return alpha1;
		case 1: return alpha2;
		case 2: return (4 * alpha1 + 1 * alpha2) / 5;
		case 3: return (3 * alpha1 + 2 * alpha2) / 5;
		case 4: return (2 * alpha1 + 3 * alpha2) / 5;
		case 5: return (1 * alpha1 + 4 * alpha2) / 5;
		case 6: return 0;
		case 7: return 255;
	}
	return 0;
}


function writeShort(data, pos, value){
	data[pos] = value & 0xFF;
	data[pos + 1] = (value >>> 8) & 0xFF;
}

function writeInt(data, pos, value, bytes){
	for (var i = 0; i < bytes; i++) {
		data[pos + i] = (value >>> i*8) & 0xFF;
	}
}

function reduceColors(data, rb, gb, bb, ab, dith) {
	var d = data.data;
	var rs = 8-rb;
	var gs = 8-gb;
	var bs = 8-bb;
	var as = 8-ab;
	var rm = 255 / (255 >> rs);
	var gm = 255 / (255 >> gs);
	var bm = 255 / (255 >> bs);
	var am = 255 / (255 >> as);
	for (var x = 0; x < data.g_width; x += 1) {
        for (var y = 0; y < data.g_height; y += 1) {
            
            var pixel = (y * data.g_width * 4) + (x * 4);
			var color = [d[pixel], d[pixel + 1], d[pixel + 2]];
			
			var floor = [Math.round(Math.floor(d[pixel] / rm) * rm),Math.round(Math.floor(d[pixel+1] / gm) * gm),Math.round(Math.floor(d[pixel+2] / bm) * bm)];
			var ceil = [Math.round(Math.ceil(d[pixel] / rm) * rm),Math.round(Math.ceil(d[pixel+1] / gm) * gm),Math.round(Math.ceil(d[pixel+2] / bm) * bm)];
			var closest = bestMatch([floor, ceil], color);

			if (closest[0] == floor[0] && closest[1] == floor[1] && closest[2] == floor[2]){
				var closest2 = ceil;
			}
			else{
				var closest2 = floor;
			}
			var alpha = Math.round(Math.floor(d[pixel+3] / am) * am);
			var alpha2 = Math.round(Math.ceil(d[pixel+3] / am) * am);
			if (Math.abs(alpha - d[pixel+3]) > Math.abs(alpha2 - d[pixel+3])){
				alpha = alpha2;
			}
			if (dith) {
				var between;
					
				between = [];
			
				// Get the 17 colors between the two previously found colors
			
				for (var b = 0; b < 17; b += 1) {
					between.push([closest[0] + (closest2[0] - closest[0]) * b/16,closest[1] + (closest2[1] - closest[1]) * b/16,closest[2] + (closest2[2] - closest[2]) * b/16]/*addColor(closest, multiplyColor(divideColor(closest2, 17), b))*/);
				}
				// Get the closest shade to the current pixel from the new 15 colors
				
				var closest3 = bestMatch(between, color);
				var index3 = between.indexOf(closest3);
				
				// Use the dithering matrix that is based on the closest shade and pick the color
				
				var trans = [closest, closest2][getDither(dither[index3], x, y)];
				d[pixel] = trans[0];
				d[pixel + 1] = trans[1];
				d[pixel + 2] = trans[2];
				
				// Apply the color to the image with full opacity
			}
			else {
				d[pixel] = closest[0];
				d[pixel + 1] = closest[1];
				d[pixel + 2] = closest[2];
			}
            d[pixel + 3] = alpha;     
        }
    }
    
    // context.putImageData(png, 0, 0);
}


function getColorDiff(color1, color2){
	return Math.abs(color1[0] - color2[0]) + Math.abs(color1[1] - color2[1]) + Math.abs(color1[2] - color2[2]);
}

function getLuminance(red, green, blue){
	if (lumaPow)
		return (0.2126*red*red/255) + (0.7152*green*green/255)+ (0.0722*blue*blue/255);
	else 
		return (0.2126*red) + (0.7152*green)+ (0.0722*blue);
}

function updateHighestResolution(g_width,g_height, framesc){
	var maxres =Math.max(g_width,g_height);

	if (framesc > 16384 && maxres > 4){
		maxres=4;
	}
	else if (framesc > 4096 && maxres > 8){
		maxres=8;
	}
	else if (framesc > 1024 && maxres > 16){
		maxres=16;
	}
	else if (framesc > 256 && maxres > 32){
		maxres=32;
	}
	else if (framesc > 64 && maxres > 64){
		maxres=64;
	}
	else if (framesc > 16 && maxres > 128){
		maxres=128;
	}
	else if (framesc > 4 && maxres > 256){
		maxres=256;
	}
	else if (framesc > 1 && maxres > 512){
		maxres=512;
	}
	for (var i=4;i <= 1024; i*=2){
		if (i >= maxres || i == 1024) {
			largestResolution = i;
			break;
		}
	}
	if (autores)
		setResolution();
}

// Function to download data to a file
async function download(data, extension) {
	var nameField = g_field_filename
	// if (!nameField.validity.valid) {
	// 	alert("Filename contains invalid characters");
	// 	return;
	// }
	// var a = document.createElement("a"),
	// 		file = new Blob([data], {type: "application/octet-stream"}),
	// 		name = nameField.value || "spray",
	// 		filename = name + "." + extension;
	// if (window.navigator.msSaveOrOpenBlob) // IE10+
	// 		window.navigator.msSaveOrOpenBlob(file, filename);
	// else { // Others
	// 		var url = URL.createObjectURL(file);
	// 		a.href = url;
	// 		a.download = filename;
	// 		document.body.appendChild(a);
	// 		a.click();
	// 		setTimeout(function() {
	// 				document.body.removeChild(a);
	// 				window.URL.revokeObjectURL(url);  
	// 		}, 0); 
	// }
	const file = new Blob([data], {type: 'application/octet-stream'})
	const name = nameField
	const filename = name + '.' + extension

	const buffer = Buffer.from( await file.arrayBuffer() );

	fs.writeFile(filename, buffer, () => console.log('saved!') );
}

function createVTF() {
	var size = 0;
	size = (g_blockCount*16);

	var file = new Uint8Array(size+64);
	console.log("save: "+g_width+" "+g_height+" "+ size);
	//var header = [86,84,70,0,7,0,0,0,1,0,0,0,64,0,0,0,0,0,0,0,12 + parseInt(document.getElementById("sampling").value),35-hasMipmaps,0,0,frameCount,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,g_outputType,0,0,0,hasMipmaps ? getReducedMipmapCount()+1 : 1,13,0,0,0,0,0,1]; // 64B (bare minimum)
	var header = [86,84,70,0,7,0,0,0,1,0,0,0,64,0,0,0,0,0,0,0,12,35-hasMipmaps,0,0,frameCount,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,g_outputType,0,0,0,1,13,0,0,0,0,0,1]; // 64B (bare minimum)
	writeShort(header,16, g_shortened ? g_width - 4 : g_width);
	writeShort(header,18, g_height);
	writeShort(header,24, frameCount);
	for (var i=0; i<header.length; i++) {
		file[i] = header[i];
	}
	// if (g_outputType == 13 || g_outputType == 15) {
		var pos = 64;
		for (var i = valueTable.length-1; i >= 0; i--){
			console.log("value "+i);
			var table = valueTable[i];
			for (var j = 0; j < table.length; j++) {
				writeInt(file,pos, table[j],4);
				pos+=4;
			}
		}
	download(file, "vtf");
}

function downloadVMT(){
	var vmtName = g_field_filename
	var vmtFileText = `Sprite
	{
		$spriteorientation oriented
		$spriteorigin "[ 0.50 0.50 ]"
		$basetexture "sprites/store/trails/${vmtName}"
	}
	`;
	download(vmtFileText, "vmt");
}

const file_picture = new File('./feelsbad.png')
g_field_filename = 'feelsbad'
const filelist = new FileList(file_picture)

handleFileSelect(filelist, () => {
	setResolution(() => {
		convert()
	})
})
