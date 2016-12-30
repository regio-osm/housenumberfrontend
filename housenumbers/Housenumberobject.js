var method = Housenumberobject.prototype;

//=============================================================================================
//logger
//---------------------------------------------------------------------------------------------
function logger(level, message) {
	console.log("Log: " + level + ": " + message);
}
//---------------------------------------------------------------------------------------------
//logger
//=============================================================================================


var HAUSNUMMERSORTIERBARLENGTH = 4;
var HAUSNUMMERNUNSETHIGH = 9999;
var HAUSNUMMERNUNSETLOW = -999;


//=============================================================================================
//Housenumberobject
//---------------------------------------------------------------------------------------------
function Housenumberobject(inId, inStrasse, inHausnummer, inBuilding, inOsmObjektart, inLon, inLat) {
	this.id = inId;
	this.strasse = inStrasse;
	this.hausnummer = inHausnummer;
	this.building = inBuilding;
	this.osm_objektart = inOsmObjektart;
	this.lon = inLon;
	this.lat = inLat;

	this.hausnummersortierbar = "";
	var hausnummersortierbar = "";
	var numstellen = 0;
	for (var posi = 0; posi < inHausnummer.length; posi++) {
		var charwert = inHausnummer.charAt(posi);
		if ((charwert >= '0') && (charwert <= '9')) {
			numstellen++;
		} else {
			break;
		}
	}
	for (var anzi = 0; anzi < (HAUSNUMMERSORTIERBARLENGTH - numstellen); anzi++) {
		hausnummersortierbar  += "0";
	}
	hausnummersortierbar += inHausnummer;
	this.hausnummersortierbar = hausnummersortierbar.substring(0,HAUSNUMMERSORTIERBARLENGTH);
	if (inHausnummer == ("" + HAUSNUMMERNUNSETLOW)) {
		this.hausnummersortierbar = inHausnummer.substring(0,HAUSNUMMERSORTIERBARLENGTH);
	}
}
//---------------------------------------------------------------------------------------------
//Housenumberobject
//=============================================================================================


module.exports = Housenumberobject;