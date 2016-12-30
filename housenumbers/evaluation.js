
// original filename from private repo: /housenumbers/auswertung

var pg = require("pg");
var swig = require("swig");
var async = require("async");
var querystring = require("querystring");
var Housenumberobject = require("./Housenumberobject");
var math = require("mathjs");

/*
 *  V1.2, 17.05.2014, Dietmar Seifert
 *  	manuelle komplette Übernahme der Änderungen von user ewoerner aus Github-Projekt
 *  
	V1.1, 20.11.2013, Dietmar Seifert
		*	Ergänung Fkt. gpx_ausgeben, um die Positionen der fehlenden Hausnummern per GPX auszugeben
*/
//TODO bei GPX-Ausgabe die Adressen in Tabelle notexisting_housenumbers herausfiltern

// TODO 06.08.2013 - in Köln bei Suche nach --Rodenkirchen in Auswahlmaske kommen 2*Rodenkirchen (9 und 10 admin_level),
//						also Namensgleichheit berücksichtigen

// TODO der Relations-Link des Stadtbezirks nach osm.org klappt irgendwie nicht
// TODO es kommt im Begründungstext z.b. \r vor für Zeilenwechsel, das gibt in Javascript einen Fehler

// =============================================================================================
//                                selectmunicipality
// ---------------------------------------------------------------------------------------------
function selectmunicipality(request, response) {
	console.time("selectmunicipality");
	
	var params = {
		landcode: request.query["landcode"] || "%"
	};

	var query_string = "SELECT land, countrycode, stadt AS name, osm_hierarchy"
		+ " FROM land, stadt"
		+ " WHERE"
		+ " stadt.land_id = land.id"
		+ " AND land.countrycode like $1";
	query_string += " ORDER BY correctorder(land), substring(osm_hierarchy from '[^,]+,[^,]+'), stadt;";		// order by country and first two levels of hierarchy: country and state
	console.log("query ==="+query_string+"===");
	
	response.simpleQuery({name: "selectmunicipality", text: query_string, values: [params.landcode]}, function(error, result) {
		if(error) {
			console.log("ERROR, due to DB select statement " + query_string + "...");
			console.log(error);
			return;
		} 
		var countries = [];
		for(var rowi = 0; rowi < result.rows.length; rowi++) {
			result.rows[rowi].namenormalized = result.rows[rowi].name.replace(/[ \-]/gi,"");
			var row_hierarchy = result.rows[rowi].osm_hierarchy;
			if(row_hierarchy != undefined) {
				var row_hierarchy_elements = row_hierarchy.split(",");
				var level1 = "";
				var level2 = "";
				if(row_hierarchy_elements.length >= 2) {
					level2 = row_hierarchy_elements[1];
				}
				if(row_hierarchy_elements.length >= 1) {
					level1 = row_hierarchy_elements[0];
				}

				var gefundenl1 = false;
				var gefundenl2 = false;
				if(level1 != "") {
					for(var aktlevel1 = 0; aktlevel1 < countries.length; aktlevel1++) {
						if(countries[aktlevel1].name == level1) {
							gefundenl1 = true;
							for(var aktlevel2 = 0; aktlevel2 < countries[aktlevel1].subcountries.length; aktlevel2++) {
								if(countries[aktlevel1].subcountries[aktlevel2].name == level2) {
									countries[aktlevel1].subcountries[aktlevel2].entries.push(result.rows[rowi]);
									gefundenl2 = true;
									break;
								}
							}
							if(gefundenl2 == false) {
								var subobject = {};
								subobject.name = level2;
								subobject.namenormalized = level2.replace(/[ \-]/gi,"");
								subobject.entries = [];
								countries[aktlevel1].subcountries.push(subobject);
								countries[aktlevel1].subcountries[countries[aktlevel1].subcountries.length-1].entries.push(result.rows[rowi]);
							}
							break;
						}
					}
					if(gefundenl1 == false) {
						var countryobject = {};
						countryobject.name = level1;
						countryobject.namenormalized = level1.replace(/[ \-]/gi,"");
						countryobject.countrycode = result.rows[rowi].countrycode;
						countryobject.subcountries= [];
						countries.push(countryobject);
						var subobject = {};
						subobject.name = level2;
						subobject.namenormalized = level2.replace(/[ \-]/gi,"");
						subobject.entries = [];
						countries[countries.length-1].subcountries.push(subobject);
						countries[countries.length-1].subcountries[0].entries.push(result.rows[rowi]);
					
					}
				}
			}
		}
		response.render('evaluation_selectmunicipality.html', {params: params, countries: countries});

		console.timeEnd("selectmunicipality");
	});
}



// =============================================================================================
//                                selectevaluation
// ---------------------------------------------------------------------------------------------
function selectevaluation(request, response) {
	console.time("selectevaluation");

	var params = {
		municipality:		request.query["municipality"] || "",
		countrycode:		request.query["country"] || ""
	};
	if(params.municipality.indexOf("%") != -1)
		params.municipality = unescape(params.municipality);

	for(var parami in params) {
		console.log("in auswertung.js/selectevaluation: params["+parami+"]===" + params[parami] + "===");
	}

	if(params.municipality == "") {
		var fehlertitel = "Auswertung einer Gemeinde: Stadt nicht ausgewählt";
		var meldetext = "Es wurde keine Stadt ausgewählt, die ausgewertet werden soll. bitte die Auswahl neu treffen.";
		var fortsetzurl = "/housenumbers/evaluation_selectmunicipality"; 
		response.render('evaluation_missingparameters.html', 
			{title: fehlertitel, fehlermeldung: meldetext, fortsetzurl: fortsetzurl});
		return;
	}

	var query_string = "SELECT jobs.id AS job_id, jobname,"
		+ " admin_level, subareasidentifyable"
		+ " FROM jobs, gebiete, land, stadt"
		+ " WHERE land.countrycode = $1 AND jobs.land_id = land.id"
		+ " AND stadt.stadt = $2 AND jobs.stadt_id = stadt.id"
		+ " AND jobs.gebiete_id = gebiete.id"
		+ " ORDER BY admin_level, jobs.jobname;";

	var subareas = [];
	response.simpleQuery({name: "selectevaluation", text: query_string, values: [params.countrycode, params.municipality]}, function(error, result) {
		result.rows.forEach(function(row) {
			var subarea = {job: row.job_id, einrueckung: "", name: row.jobname};

			console.log("checking subarea for dialog: subareaname==="+subarea.name+"===   subareasharp?==="+row.subareasidentifyable+"===  level==="+row.admin_level+"===");

			for(var leveli=8; leveli<row.admin_level; leveli++)
				subarea.einrueckung += "-";
	
			if(row.admin_level >= 4) {
				subareas.push(subarea);
			}
		});
		response.render("evaluation_selectevaluation.html", {params: params, subareas: subareas});
		console.timeEnd("selectevaluation");
	});
}



//=============================================================================================
//			exportieren der offiziellen Adressen mit offiziellen Geokoordinaten, wenn verfügbar
//---------------------------------------------------------------------------------------------
function offizielle_koordinaten_ausgeben(request, response) {
	console.time("offizielle_koordinaten_ausgeben");

	var params = {
		job_id: request.query["job_id"] || ""
	};
	for(var parami in params) {
		console.log("in auswertung.js/offizielle_koordinaten_ausgeben: params["+parami+"]===" + params[parami] + "===");
	}

	return response.getClient(function(err, client, done) {
		if(err != undefined) {
			console.log("FEHLER bei pg.connect ...");
			console.log("Forts. "+err.toString());
		}

		var query_string = "SELECT sh.id AS sh_id, ST_X(sh.point) AS lon, ST_Y(sh.point) AS lat,"
			+ " strasse, sh.hausnummer AS hausnummer, officialgeocoordinates,"
			+ " parameters->'listcoordosmuploadable' AS paralistcoordosmuploadable,"
			+ " parameters->'listcoordosmuploadlimitcount' AS paralistcoordosmuploadlimitcount"
			+ " FROM auswertung_hausnummern AS ah, stadt_hausnummern AS sh, strasse AS str, stadt AS s"
			+ " WHERE ah.stadt_id = sh.stadt_id AND ah.strasse_id = sh.strasse_id"
			+ " AND ah.hausnummer = sh.hausnummer"
			+ " AND ah.job_id = $1"
			+ " AND (treffertyp = 's' OR treffertyp = 'l')"
			+ " AND sh.strasse_id = str.id"
			+ " AND sh.stadt_id = s.id"
			+ " ORDER BY strasse, sh.hausnummer_sortierbar;";
console.log("query_string ==="+query_string+"===");
console.log("params.job_id ==="+params.job_id+"===");
		var hausnummern = [];

		var query_hnr = client.query({name: "hnr_koordinaten", text: query_string, values: [params.job_id]});
		var osmnodeid = -1;
		var paralistcoordosmuploadable;
		var paralistcoordosmuploadlimitcount = 999999;
		var counthousenumbers= 0;

		query_hnr.on("row",function(row) {
			if(row.paralistcoordosmuploadable)
				paralistcoordosmuploadable = row.paralistcoordosmuploadable;
			if(row.paralistcoordosmuploadlimitcount)
				paralistcoordosmuploadlimitcount = 0 + row.paralistcoordosmuploadlimitcount;

			if(row.lon != null) {
				if(		(row.officialgeocoordinates == "y")
					||	((row.paralistcoordosmuploadable == "yes") && (paralistcoordosmuploadlimitcount < counthousenumbers))) {
					counthousenumbers++;
					row['id'] = osmnodeid--;
					hausnummern.push(row);
					console.log("add official housenumber: " + row.strasse + " " + row.hausnummer
						+ "   Geokoord. lon/lat: " + row.lon + "   " + row.lat);
				}
			} else {
				console.log("ignore record in auswertung_hausnummern with id: " + row.sh_id);
			}
		});		// end of query_hnr.on("row")
		console.log("Anzahl vergebene osmids: "+osmnodeid);

		query_hnr.on("end",function(result) {
			console.log("Count official housenumbers still missing: " + hausnummern.length);
			done();

			var osmfilecontent = "";
			osmfilecontent += "<osm version='0.6' upload='false' generator='regio-osm.de:hausnummerauswertung'>";
			var counthousenumbers= 0;
			for(var hnrindex in hausnummern) {
				var hnr = hausnummern[hnrindex];
				counthousenumbers++;
				if(		(paralistcoordosmuploadlimitcount != undefined)
					&&	(paralistcoordosmuploadlimitcount < counthousenumbers))
					break;
				osmfilecontent += "<node id='" + hnr.id + "' action='modify' visible='true' lat='" + hnr.lat + "' lon='" + hnr.lon + "'>";
				osmfilecontent += "<tag k='addr:street' v='" + hnr.strasse + "' />";
				osmfilecontent += "<tag k='addr:housenumber' v='" + hnr.hausnummer + "' />";
				osmfilecontent += "</node>";
			}
			osmfilecontent += "</osm>";
			
			if(hausnummern.length > 0) {
				response.render("osmuploadtojosm.html", {osmfilecontent: osmfilecontent});
			} else {
				response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
				response.write("Es gibt keine offiziellen Geokoordinaten in dieser Umgebung.\n");
				response.end();
			}

			console.timeEnd("offizielle_koordinaten_ausgeben");
		});		// end of query_hnr.on("end")
	});
}
//---------------------------------------------------------------------------------------------
//offizielle_koordinaten_ausgeben
//=============================================================================================



//=============================================================================================
//check osm objects with housenumbers against official geocoordinates (how far away in osm from official position)
//---------------------------------------------------------------------------------------------
function offizielle_koordinaten_abgleichen(request, response) {
	console.time("offizielle_koordinaten_abgleichen");

	var params = {
		job_id: request.query["job_id"] || ""
	};

	for(var parami in params) {
		console.log("in auswertung.js/offizielle_koordinaten_abgleichen: params["+parami+"]===" + params[parami] + "===");
	}


	return response.getClient(function(err, client, done) {
		if(err != undefined) {
			console.log("FEHLER bei pg.connect ...");
			console.log("Forts. "+err.toString());
		}

//TODO set dynamically the right transformation projection system to calculate distance in meters
/*		var query_string = "SELECT strasse, sh.hausnummer AS hausnummer, osm_id, osm_objektart,"
			+ " ST_X(ST_AsText(sh.point)) AS liste_koordinate_lon, ST_Y(ST_AsText(sh.point)) AS liste_koordinate_lat,"
			+ " ST_X(ST_AsText(ah.point)) AS osm_koordinate_lon, ST_Y(ST_AsText(ah.point)) AS osm_koordinate_lat,"
			+ " round(ST_Distance(ST_Transform(sh.point,31468), ST_Transform(ah.point,31468))::numeric, 3) AS diff"
			+ " FROM stadt_hausnummern AS sh, auswertung_hausnummern AS ah, strasse AS str"
			+ " WHERE job_id = $1 AND"
			+ " (NOT ah.point IS null) AND (NOT sh.point IS null) AND"
			+ " sh.stadt_id = ah.stadt_id AND sh.strasse_id = ah.strasse_id AND"
			+ " sh.hausnummer ilike ah.hausnummer AND sh.strasse_id = str.id"
			+ " ORDER BY diff DESC, correctorder(strasse), sh.hausnummer_sortierbar"
			+ " LIMIT 5000;";
*/
		var query_string = "SELECT strasse, sh.hausnummer AS hausnummer, osm_id, osm_objektart,"
			+ " ST_X(ST_AsText(sh.point)) AS liste_koordinate_lon, ST_Y(ST_AsText(sh.point)) AS liste_koordinate_lat,"
			+ " ST_X(ST_AsText(ah.point)) AS osm_koordinate_lon, ST_Y(ST_AsText(ah.point)) AS osm_koordinate_lat"
//			+ ", round(ST_Distance(ST_Transform(sh.point,31468), ST_Transform(ah.point,31468))::numeric, 3) AS diff"
			+ ", round(lonlatdistance(ST_X(ah.point), ST_Y(ah.point), ST_X(sh.point), ST_Y(sh.point))::numeric, 1) AS diff"
			+ " FROM stadt_hausnummern AS sh"
			+ " JOIN stadt AS s ON sh.stadt_id = s.id"
			+ " JOIN auswertung_hausnummern As ah ON sh.stadt_id = ah.stadt_id AND sh.strasse_id = ah.strasse_id AND sh.hausnummer ilike ah.hausnummer"
			+ " AND ((sh.postcode is null) OR (sh.postcode = ah.postcode))"		// if official list contains postcode, then postcode will be compared
			+ " JOIN strasse AS str ON sh.strasse_id = str.id"
			+ " WHERE job_id = $1 AND treffertyp = 'i'"
			+ " ORDER BY diff DESC, correctorder(strasse), sh.hausnummer_sortierbar"
			+ " LIMIT 5000;";
		
		console.log("query_string ==="+query_string+"===");
		console.log("params.job_id ==="+params.job_id+"===");
		var hausnummern = [];

		var query_hnr = client.query({name: "hnr_koordinaten", text: query_string, values: [params.job_id]});

		query_hnr.on("row",function(row) {
			hausnummern.push(row);
		});		// end of query_hnr.on("row")

		query_hnr.on("end",function(result) {
			console.log("Count matched housenumbers: " + hausnummern.length);
			done();

			if(hausnummern.length > 0) {
				response.render("geokoordinaten_abgleichen.html", {params: params, hausnummern: hausnummern});
			} else {
				response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
				response.write("Es gibt keine offiziellen Geokoordinaten in dieser Umgebung.\n");
				response.end();
			}
	
			console.timeEnd("offizielle_koordinaten_abgleichen");
		});		// end of query_hnr.on("end")
	});
}
//---------------------------------------------------------------------------------------------
//offizielle_koordinaten_abgleichen
//=============================================================================================



//=============================================================================================
// calculate the approximated coordinates for housenumbers, which are still missing in OSM
//---------------------------------------------------------------------------------------------
function calculateCoordinateForAMissingHousenumber(strasse, strasseLonLat, hausnummerFehlend, osmHnrobjekte, osmHnrobjekteAnzahl) {
//	private static String ermittelteAdressposition(final String strasse, final String strasseLonlat, 
//			final String hausnummerFehlend, final Housenumberobject[] osmHnrobjekte, 
//			final Integer osmHnrobjekteAnzahl) {
	var LONGUNSET = 4711;

	var neuLon = LONGUNSET;
	var neuLat = LONGUNSET;

	var HAUSNUMMERSORTIERBARLENGTH = 4;
	var HAUSNUMMERNUNSETHIGH = 9999;
	var HAUSNUMMERNUNSETLOW = -999;
	
	console.log("ok, Start Versuch, Hausnummer zu interpolieren für fehlende Hnr ===" + hausnummerFehlend + "===");

	var lonAufStrasse = 0.0;
	var latAufStrasse = 0.0;
	if(strasseLonLat != "") {
		var tempstring = strasseLonlat.substring(0, strasseLonlat.indexOf(" "));
		console.log("auf-strasse lon (string) ===" + tempstring + "===");
		lonAufStrasse = 0.0 + tempstring;
	
		tempstring = strasseLonlat.substring(strasseLonlat.indexOf(" ") + 1);
		console.log("auf-strasse lat (string) ===" + tempstring + "===");
		latAufStrasse = 0.0 + tempstring;
	}

		// verwende nur den numerischen Teil der normierten Hausnummer 
		// z.b. 0001 (0001 1/2) für 1 1/2 oder 0047 (Orig: 0047a) für 47a
	var hausnummerPur = "";
	var hausnummersuffix = "";
	var wildcardPattern = new RegExp("(\\d+)([\d\s\w]*)");
	var sb = hausnummerFehlend.replace(wildcardPattern, "$1");
	var hnrSuffixsb = hausnummerFehlend.replace(wildcardPattern, "$2");

	hausnummerPur = sb;
	hausnummersuffix = hnrSuffixsb.trim();
	console.log("Kalkulierungs-Hausnummer pur ===" + hausnummerPur + "===   Suffix ===" + hausnummersuffix 
		+ "===,     Original war ===" + hausnummerFehlend + "===");

	var hausnummerFehlendInteger = parseInt(hausnummerPur, 10);


	var akthausnummer = 0;



	var hnrobjektGeradeUnterhalb1 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETLOW, "dummy", "", "");
	var hnrobjektGeradeOberhalb1 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETHIGH, "dummy", "", "");
	var hnrobjektUngeradeUnterhalb1 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETLOW, "dummy", "", "");
	var hnrobjektUngeradeOberhalb1 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETHIGH, "dummy", "", "");

	var hnrobjektGeradeUnterhalb2 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETLOW, "dummy", "", "");
	var hnrobjektGeradeOberhalb2 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETHIGH, "dummy", "", "");
	var hnrobjektUngeradeUnterhalb2 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETLOW, "dummy", "", "");
	var hnrobjektUngeradeOberhalb2 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETHIGH, "dummy", "", "");

	var bisherSummeEntfernt1Entfernt2Unterhalb = HAUSNUMMERNUNSETHIGH;
	var bisherSummeEntfernt1Entfernt2Oberhalb = HAUSNUMMERNUNSETHIGH;
	var bisherSummeEntfernt1Entfernt2UnterhalbGegenseite = HAUSNUMMERNUNSETHIGH;
	var bisherSummeEntfernt1Entfernt2OberhalbGegenseite = HAUSNUMMERNUNSETHIGH;


	for (var hnrobjektindex = 0; hnrobjektindex < osmHnrobjekteAnzahl; hnrobjektindex++) {
		var aktOsmHnrobjekt = osmHnrobjekte[hnrobjektindex];

		akthausnummer = parseInt(aktOsmHnrobjekt.hausnummersortierbar);
		//console.log("akuelle Hausnummer original ===" + aktOsmHnrobjekt.hausnummer 
		//	+ "===  numerisch ermittelt ===" + akthausnummer + "==="
		//	+ "   (" + aktOsmHnrobjekt.lon + "/" + aktOsmHnrobjekt.lat + ")");

		if(aktOsmHnrobjekt.lon == "") {
			//console.log("   wird ignoriert, weil ohne lon/lat-Koordinaten");
			continue;
		}
		
		var aktuellVerbesserung = false; 
			// hier kommt < 0 für Hausnummern unterhalb der gesuchten und > 0 für Hausnummern größer der gesuchten heraus
		var diffHausnummer = akthausnummer - hausnummerFehlendInteger;

		//console.log("numerisch ==" + akthausnummer + " , Diff: " + diffHausnummer + ", wurde geholt");

		if ((akthausnummer % 2) == 0) {
			// aktuell gerade Hausnummer
			if (diffHausnummer < 0) {
				//console.log("gerade-diff<0: akthausnummer: " + akthausnummer + "  vergleich-ob1: " + parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar)
				//		+ "  vergleich-ob2: " + parseInt(hnrobjektGeradeUnterhalb2.hausnummersortierbar));
					// gefundene Hausnummer ist kleiner (numerisch unterhalb) als aktuelle
				if (akthausnummer > parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar)) {
						// gefundene aktuelle ist näher unterhalb zur Suchhausnummer, also besser als die früher gefundene
					hnrobjektGeradeUnterhalb2 = hnrobjektGeradeUnterhalb1;
					hnrobjektGeradeUnterhalb1 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				} else if ((akthausnummer > parseInt(hnrobjektGeradeUnterhalb2.hausnummersortierbar)) 
						&& (akthausnummer < parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar))) {
						// gefundene aktuelle ist zwar nicht näher als die erst-nächste, aber näher 
						// als die früher gefundene zweit-nächste 
						// (relevant für später, wenn im weiteren Suchdurchlauf keine höhere 
						// als die Suchnummer gefunden wird, zur Extrapolation
					hnrobjektGeradeUnterhalb2 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				}
			} else if (diffHausnummer > 0) {
				//console.log("gerade-diff>0: akthausnummer: " + akthausnummer + "  vergleich-ob1: " + parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar)
				//		+ "  vergleich-ob2: " + parseInt(hnrobjektGeradeOberhalb2.hausnummersortierbar));
					// gefundene Hausnummer ist größer (numerisch oberhalb) als aktuelle
				if (akthausnummer < parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar)) {
					// gefundene aktuelle ist näher oberhalb zur Suchhausnummer, also besser als die früher gefundene
					hnrobjektGeradeOberhalb2 = hnrobjektGeradeOberhalb1;
					hnrobjektGeradeOberhalb1 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				} else if ((akthausnummer < parseInt(hnrobjektGeradeOberhalb2.hausnummersortierbar)) 
						&& (akthausnummer > parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar))) {
						// gefundene aktuelle ist zwar nicht näher als die erst-nächste, 
						// aber näher als die früher gefundene zweit-nächste
						// (relevant für später, wenn im weiteren Suchdurchlauf keine tiefere 
						// als die Suchnummer gefunden wird, zur Extrapolation
					hnrobjektGeradeOberhalb2 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				}
			}
		} else {
				// aktuell ungerade Hausnummer
			if (diffHausnummer < 0) {
				//console.log("ungerade-diff<0: akthausnummer: " + akthausnummer + "  vergleich-ob1: " + parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar)
				//	+ "  vergleich-ob2: " + parseInt(hnrobjektUngeradeUnterhalb2.hausnummersortierbar));
				if (akthausnummer > parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar)) {
					hnrobjektUngeradeUnterhalb2 = hnrobjektUngeradeUnterhalb1;
					hnrobjektUngeradeUnterhalb1 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				} else if ((akthausnummer > parseInt(hnrobjektUngeradeUnterhalb2.hausnummersortierbar))  
						&& (akthausnummer < parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar))) {
					hnrobjektUngeradeUnterhalb2 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				}
			} else if (diffHausnummer > 0) {
				//console.log("ungerade-diff>0: akthausnummer: " + akthausnummer + "  vergleich-ob1: " + parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar)
				//		+ "  vergleich-ob2: " + parseInt(hnrobjektUngeradeOberhalb2.hausnummersortierbar));
				if (akthausnummer < parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar)) {
					hnrobjektUngeradeOberhalb2 = hnrobjektUngeradeOberhalb1;
					hnrobjektUngeradeOberhalb1 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				} else if ((akthausnummer < parseInt(hnrobjektUngeradeOberhalb2.hausnummersortierbar)) 
					&& (akthausnummer > parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar))) {
					hnrobjektUngeradeOberhalb2 = aktOsmHnrobjekt;
					aktuellVerbesserung = true;
					//.hausnummer muß entweder noch auf diffHausnummer gesetzt werden oder .hausnummer muß anders interpretiert werden
				}
			}
		}
	}

	//console.log("------------ Ausgabe entfernte Knoten ------------------ ...");
	//console.log("Struktur GERADE [0] u: " + hnrobjektGeradeUnterhalb1.hausnummer + ",  o: " + hnrobjektGeradeOberhalb1.hausnummer);
	//console.log("  osm_id: " + hnrobjektGeradeUnterhalb1.id + "   osm-Objektart===" + hnrobjektGeradeUnterhalb1.osm_objektart + "===");
	//console.log("                [1] u: " + hnrobjektGeradeUnterhalb2.hausnummer + ",  o: " + hnrobjektGeradeOberhalb2.hausnummer);
	//console.log("  osm_id: " + hnrobjektGeradeUnterhalb2.id + "   osm-Objektart===" + hnrobjektGeradeUnterhalb2.osm_objektart + "===");
	//console.log("Struktur UNGERADE [0] u: " + hnrobjektUngeradeUnterhalb1.hausnummer + ",  o: " + hnrobjektUngeradeOberhalb1.hausnummer);
	//console.log("  osm_id: " + hnrobjektUngeradeUnterhalb1.id + "   osm-Objektart===" + hnrobjektUngeradeUnterhalb1.osm_objektart + "===");
	//console.log("                  [1] u: " + hnrobjektUngeradeUnterhalb2.hausnummer + ",  o: " + hnrobjektUngeradeOberhalb2.hausnummer);
	//console.log("  osm_id: " + hnrobjektUngeradeUnterhalb2.id + "   osm-Objektart===" + hnrobjektUngeradeUnterhalb2.osm_objektart + "===");
	//console.log("------------ Ausgabe entfernte Knoten ------------------ ");

		// Test, ob ober- und unterhalb jeweils eine Hausnummer verfügbar ist
	var hnrobjektUnterhalb = new Housenumberobject(-1, strasse, "0", "dummy", "", "");
	var hnrobjektOberhalb = new Housenumberobject(-1, strasse, "0", "dummy", "", "");
	var loesungshausnummerSelbeSeiteWieSuchhausnummer = true;

		// Test, ob in einer Richtung zwei Knoten hintereinander verfügbar sind
	var hnrobjektEntfernt1 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETHIGH, "dummy", "", "");
	var hnrobjektEntfernt2 = new Housenumberobject(-1, strasse, "" + HAUSNUMMERNUNSETHIGH, "dummy", "", "");
	var aktuellSummeEntfernt1Entfernt2 = HAUSNUMMERNUNSETHIGH;

	// weiter oben erstmal die erst-nächst-tiefern und zweit-nächst-tieferen und genauso -höheren, 
	// jeweils für gerade und ungerade Hausnummern gefunden.
	// hier jetzt die Suche nach den besten Werten von oben, die verwendet werden sollen.

	var strategie = "";
	if ((hausnummerFehlendInteger % 2) == 0) { 
			// Such-Nr. ist gerade
		if(		(parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
			&&	(parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
				// Bester Fall: Such-Nr. ist gerade und es wurde eine gerade Hausnummer unterhalb und eine oberhalb gefunden
			hnrobjektUnterhalb = hnrobjektGeradeUnterhalb1;
			hnrobjektOberhalb = hnrobjektGeradeOberhalb1;
			loesungshausnummerSelbeSeiteWieSuchhausnummer = true;
			strategie = "unter-oberhalb";
		} else if ((parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
				&& (parseInt(hnrobjektGeradeUnterhalb2.hausnummersortierbar) > HAUSNUMMERNUNSETLOW)) {
				//prüfen
			aktuellSummeEntfernt1Entfernt2 = 
				(hausnummerFehlendInteger - parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar)) 
				+ (hausnummerFehlendInteger - parseInt(hnrobjektGeradeUnterhalb2.hausnummersortierbar));
			//console.log(" Lösung gerade Hausnummerm unterhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2Unterhalb) {
				hnrobjektEntfernt1 = hnrobjektGeradeUnterhalb1;
				hnrobjektEntfernt2 = hnrobjektGeradeUnterhalb2;
				bisherSummeEntfernt1Entfernt2Unterhalb = 
					(hausnummerFehlendInteger - parseInt(hnrobjektEntfernt1.hausnummersortierbar)) 
					+ (hausnummerFehlendInteger - parseInt(hnrobjektEntfernt2.hausnummersortierbar));
				loesungshausnummerSelbeSeiteWieSuchhausnummer = true;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else if ((parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH) 
			&& (parseInt(hnrobjektGeradeOberhalb2.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
				//prüfen
			aktuellSummeEntfernt1Entfernt2 = 
				(parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar) - hausnummerFehlendInteger) 
				+ (parseInt(hnrobjektGeradeOberhalb2.hausnummersortierbar) - hausnummerFehlendInteger);
			//console.log(" Lösung gerade Hausnummerm oberhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2Oberhalb) {
				hnrobjektEntfernt1 = hnrobjektGeradeOberhalb1;
				hnrobjektEntfernt2 = hnrobjektGeradeOberhalb2;
				bisherSummeEntfernt1Entfernt2Oberhalb = 
					(parseInt(hnrobjektEntfernt1.hausnummersortierbar) - hausnummerFehlendInteger) 
					+ (parseInt(hnrobjektEntfernt2.hausnummersortierbar) - hausnummerFehlendInteger);
				loesungshausnummerSelbeSeiteWieSuchhausnummer = true;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else if ((parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
			&& (parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
				// Zweitbester Fall: Such-Nr. ist gerade und es wurde eine ungerade Hausnummer unterhalb 
				// und eine oberhalb gefunden (also auf der anderen Straßenseite)
			hnrobjektUnterhalb = hnrobjektUngeradeUnterhalb1;
			hnrobjektOberhalb = hnrobjektUngeradeOberhalb1;
			loesungshausnummerSelbeSeiteWieSuchhausnummer = false;
			strategie = "unter-oberhalb";
		} else if ((parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
			&& (parseInt(hnrobjektUngeradeUnterhalb2.hausnummersortierbar) > HAUSNUMMERNUNSETLOW)) {
				//prüfen
			aktuellSummeEntfernt1Entfernt2 = 
				(hausnummerFehlendInteger - parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar)) 
				+ (hausnummerFehlendInteger - parseInt(hnrobjektUngeradeUnterhalb2.hausnummersortierbar));
			//console.log(" Lösung ungerade Hausnummerm unterhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2UnterhalbGegenseite) {
				hnrobjektEntfernt1 = hnrobjektUngeradeUnterhalb1;
				hnrobjektEntfernt2 = hnrobjektUngeradeUnterhalb2;
				bisherSummeEntfernt1Entfernt2UnterhalbGegenseite = 
					(hausnummerFehlendInteger - parseInt(hnrobjektEntfernt1.hausnummersortierbar)) 
					+ (hausnummerFehlendInteger - parseInt(hnrobjektEntfernt2.hausnummersortierbar));
				loesungshausnummerSelbeSeiteWieSuchhausnummer = false;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else if ((parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH) 
				&& (parseInt(hnrobjektUngeradeOberhalb2.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
				//prüfen
			aktuellSummeEntfernt1Entfernt2 = 
				(parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar) - hausnummerFehlendInteger) 
				+ (parseInt(hnrobjektUngeradeOberhalb2.hausnummersortierbar) - hausnummerFehlendInteger);
			//console.log(" Lösung ungerade Hausnummerm oberhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2OberhalbGegenseite) {
				hnrobjektEntfernt1 = hnrobjektUngeradeOberhalb1;
				hnrobjektEntfernt2 = hnrobjektUngeradeOberhalb2;
				bisherSummeEntfernt1Entfernt2OberhalbGegenseite = 
					(parseInt(hnrobjektEntfernt1.hausnummersortierbar) - hausnummerFehlendInteger) 
					+ (parseInt(hnrobjektEntfernt2.hausnummersortierbar) - hausnummerFehlendInteger);
				loesungshausnummerSelbeSeiteWieSuchhausnummer = false;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else {
			//console.log("Gerade Hausnummer gesucht: " + hausnummerFehlend 
			//	+ ", aber nicht interpolierbar über Strategie unter-/oberhalb");
		}
	} else {
			// Such-Nr. ist ungerade
		if ((parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
			&& (parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
				// Bester Fall: Such-Nr. ist ungerade und es wurde eine ungerade Hausnummer unterhalb 
				// und eine oberhalb gefunden
			hnrobjektUnterhalb = hnrobjektUngeradeUnterhalb1;
			hnrobjektOberhalb = hnrobjektUngeradeOberhalb1;
			loesungshausnummerSelbeSeiteWieSuchhausnummer = true;
			strategie = "unter-oberhalb";
		} else if ((parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
				&& (parseInt(hnrobjektUngeradeUnterhalb2.hausnummersortierbar) > HAUSNUMMERNUNSETLOW)) {
			aktuellSummeEntfernt1Entfernt2 = 
				(hausnummerFehlendInteger - parseInt(hnrobjektUngeradeUnterhalb1.hausnummersortierbar)) 
				+ (hausnummerFehlendInteger - parseInt(hnrobjektUngeradeUnterhalb2.hausnummersortierbar));
			//console.log(" Lösung ungerade Hausnummerm unterhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2Unterhalb) {
				hnrobjektEntfernt1 = hnrobjektUngeradeUnterhalb1;
				hnrobjektEntfernt2 = hnrobjektUngeradeUnterhalb2;
				bisherSummeEntfernt1Entfernt2Unterhalb = 
					(hausnummerFehlendInteger - parseInt(hnrobjektEntfernt1.hausnummersortierbar)) 
					+ (hausnummerFehlendInteger - parseInt(hnrobjektEntfernt2.hausnummersortierbar));
				loesungshausnummerSelbeSeiteWieSuchhausnummer = true;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else if ((parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)  
				&& (parseInt(hnrobjektUngeradeOberhalb2.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
			aktuellSummeEntfernt1Entfernt2 = 
				(parseInt(hnrobjektUngeradeOberhalb1.hausnummersortierbar) - hausnummerFehlendInteger) 
				+ (parseInt(hnrobjektUngeradeOberhalb2.hausnummersortierbar) - hausnummerFehlendInteger);
			//console.log(" Lösung ungerade Hausnummerm oberhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2Oberhalb) {
				hnrobjektEntfernt1 = hnrobjektUngeradeOberhalb1;
				hnrobjektEntfernt2 = hnrobjektUngeradeOberhalb2;
				bisherSummeEntfernt1Entfernt2Oberhalb = (parseInt(hnrobjektEntfernt1.hausnummersortierbar) 
							- hausnummerFehlendInteger) 
							+ (parseInt(hnrobjektEntfernt2.hausnummersortierbar) - hausnummerFehlendInteger);
				loesungshausnummerSelbeSeiteWieSuchhausnummer = true;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else if ((parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW)  
				&& (parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
				// Zweitbester Fall: Such-Nr. ist ungerade und es wurde eine gerade Hausnummer unterhalb 
				// und eine oberhalb gefunden (also auf der anderen Straßenseite)
			hnrobjektUnterhalb = hnrobjektGeradeUnterhalb1;
			hnrobjektOberhalb = hnrobjektGeradeOberhalb1;
			loesungshausnummerSelbeSeiteWieSuchhausnummer = false;
			strategie = "unter-oberhalb";
		} else if ((parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar) > HAUSNUMMERNUNSETLOW) 
				&& (parseInt(hnrobjektGeradeUnterhalb2.hausnummersortierbar) > HAUSNUMMERNUNSETLOW)) {
			aktuellSummeEntfernt1Entfernt2 = 
				(hausnummerFehlendInteger - parseInt(hnrobjektGeradeUnterhalb1.hausnummersortierbar)) 
				+ (hausnummerFehlendInteger - parseInt(hnrobjektGeradeUnterhalb2.hausnummersortierbar));
			//console.log(" Lösung gerade Hausnummerm unterhalb 2fach vorhanden, Summe Entfernung aktuell: " 
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2UnterhalbGegenseite) {
				hnrobjektEntfernt1 = hnrobjektGeradeUnterhalb1;
				hnrobjektEntfernt2 = hnrobjektGeradeUnterhalb2;
				bisherSummeEntfernt1Entfernt2UnterhalbGegenseite = 
					(hausnummerFehlendInteger - parseInt(hnrobjektEntfernt1.hausnummersortierbar)) 
					+ (hausnummerFehlendInteger - parseInt(hnrobjektEntfernt2.hausnummersortierbar));
				loesungshausnummerSelbeSeiteWieSuchhausnummer = false;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else if ((parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH) 
				&& (parseInt(hnrobjektGeradeOberhalb2.hausnummersortierbar) < HAUSNUMMERNUNSETHIGH)) {
			aktuellSummeEntfernt1Entfernt2 = 
				(parseInt(hnrobjektGeradeOberhalb1.hausnummersortierbar) - hausnummerFehlendInteger)  
				+ (parseInt(hnrobjektGeradeOberhalb2.hausnummersortierbar) - hausnummerFehlendInteger);
			//console.log(" Lösung gerade Hausnummerm oberhalb 2fach vorhanden, Summe Entfernung aktuell: "  
			//	+ aktuellSummeEntfernt1Entfernt2);
			if (aktuellSummeEntfernt1Entfernt2 < bisherSummeEntfernt1Entfernt2OberhalbGegenseite) {
				hnrobjektEntfernt1 = hnrobjektGeradeOberhalb1;
				hnrobjektEntfernt2 = hnrobjektGeradeOberhalb2;
				bisherSummeEntfernt1Entfernt2OberhalbGegenseite = 
						(parseInt(hnrobjektEntfernt1.hausnummersortierbar) - hausnummerFehlendInteger)  
						+ (parseInt(hnrobjektEntfernt2.hausnummersortierbar) - hausnummerFehlendInteger);
				loesungshausnummerSelbeSeiteWieSuchhausnummer = false;
				strategie = "beide-unter-oder-oberhalb";
			}
		} else {
			//console.log("Ungerade Hausnummer gesucht: " + hausnummerFehlend 
			//		+ ", aber nicht interpolierbar über Strategie unter-/oberhalb");
		}
	}
	console.log("gesetzte Strategie: " + strategie);

		// ============================================================================================
		// ====================================== Unter/Oberhalb ======================================
	if (strategie == "unter-oberhalb") {
		//console.log("ok, die Interpolation erfolgt jetzt mit Strategie "  + strategie  + " ...");
		//console.log("genommene H-Nr. unterhalb: " + hnrobjektUnterhalb.hausnummer + "    oberhalb: "  
		//	+ hnrobjektOberhalb.hausnummer);
		//console.log(" (Forts.) mit den osm-ids   unterhalb: " + hnrobjektUnterhalb.id + "    oberhalb: "  
		//	+ hnrobjektOberhalb.id);


		var lonUnterhalb = parseFloat(hnrobjektUnterhalb.lon);
		var latUnterhalb = parseFloat(hnrobjektUnterhalb.lat);
		var lonOberhalb = parseFloat(hnrobjektOberhalb.lon);
		var latOberhalb = parseFloat(hnrobjektOberhalb.lat);
	

			// wenn von den umliegenden Objekten Koordinaten vorliegen, 
			// ermittle die interpolierten Koordinaten der aktuellen Hausnummer
		var hausnummernTeile = parseInt(hnrobjektOberhalb.hausnummersortierbar) 
			- parseInt(hnrobjektUnterhalb.hausnummersortierbar);
		//console.log("Differenz Unterhalb/Oberhalb Hausnummern netto: " + hausnummernTeile);
		var lonTeil = parseFloat((lonOberhalb - lonUnterhalb) / hausnummernTeile);
		var latTeil = parseFloat((latOberhalb - latUnterhalb) / hausnummernTeile);
		neuLon = lonOberhalb - (parseInt(hnrobjektOberhalb.hausnummersortierbar) - hausnummerFehlendInteger) 
			* lonTeil;
		neuLat = latOberhalb - (parseInt(hnrobjektOberhalb.hausnummersortierbar) - hausnummerFehlendInteger) 
			* latTeil;
				//TODO derzeit noch Luftlinien-Approx, besser wäre zusätzlicher richtiger Abstand zur Straße berechnen
		//console.log("neues Objekt ===POINT(" + neuLon + " " + neuLat + ")===");

			// wenn auf der selben Straßenseite wie die aktuelle Hausnummer 
			// keine unterhalb und oberhalb-Hausnummern gefunden wurden,
			// versuche es jetzt auf der gegenüberliegenden Straßenseite
		if (	!loesungshausnummerSelbeSeiteWieSuchhausnummer 
			&&	(strasseLonLat != "")) {
////V1.5postgisif ( 1 == 0) {
														// Sonderfall es wurden Hausnummern von der 
														// gegenüberliegenden Straßenseite genommen, 
														// also Ziel-Punkt an Straße spiegeln

			var diffLon = parseFloat(lonAufStrasse - neuLon);
			var diffLat = parseFloat(latAufStrasse - neuLat);
				//TODO hier kam neuLon = 4711.0 an, wurde also nicht geprüft
			//console.log("neuLon ===" + neuLon + "===    neuLat===" + neuLat + "===");
			//console.log("diffLon ===" + diffLon + "===  diffLat===" + diffLat + "===");

			neuLon  += 2 * diffLon;
			neuLat  += 2 * diffLat;
			//console.log("andere-strassenseite neues Objekt ===POINT(" + neuLon + " " + neuLat + ")===");
				//TODO hier erfolgt eine PUNKTSPIEGELUNG um Straßen-Schwerpunkt, das verfälscht u.U. stark
		}
		//console.log("am ende neues Objekt ===POINT(" + neuLon + " " + neuLat + ")===");
	} // Ende von Interpolation möglich wg. unter- und oberhalb Knoten vorhanden  {
		// -------------------------------------- Unter/Oberhalb --------------------------------------
		// --------------------------------------------------------------------------------------------


		// ========================================================================================================
		// ====================================== beide unter- oder oberhalb ======================================
	if (strategie == "beide-unter-oder-oberhalb") {
		//console.log("ok, die Interpolation erfolgt jetzt mit Strategie "  + strategie  + " ...");
		//console.log("  entfernt1: " + hnrobjektEntfernt1.hausnummer + "  (" + hnrobjektEntfernt1.lon + "/" + hnrobjektEntfernt1.lat + ")    entfernt2: " 
		//	+ hnrobjektEntfernt2.hausnummer + "  (" + hnrobjektEntfernt2.lon + "/" + hnrobjektEntfernt2.lat + ")");


		var lonEntfernt1 = parseFloat(hnrobjektEntfernt1.lon);
		var latEntfernt1 = parseFloat(hnrobjektEntfernt1.lat);
			//TODO evtl. könnte hnrobjektEntfernt2 mal leer oder null sein, prüfen
		var lonEntfernt2 = parseFloat(hnrobjektEntfernt2.lon);
		var latEntfernt2 = parseFloat(hnrobjektEntfernt2.lat);

		var hausnummernTeile = parseInt(hnrobjektEntfernt2.hausnummersortierbar) 
			- parseInt(hnrobjektEntfernt1.hausnummersortierbar);
		//console.log("Differenz entfernt1/entfernt2 Hausnummern netto: " + hausnummernTeile);
		var lonTeil = parseFloat((lonEntfernt2 - lonEntfernt1) / hausnummernTeile);
		var latTeil = parseFloat((latEntfernt2 - latEntfernt1) / hausnummernTeile);
		neuLon = lonEntfernt1 - (parseInt(hnrobjektEntfernt1.hausnummersortierbar) - hausnummerFehlendInteger) 
			* lonTeil;
		neuLat = latEntfernt1 - (parseInt(hnrobjektEntfernt1.hausnummersortierbar) - hausnummerFehlendInteger) 
			* latTeil;
		//console.log("neues Objekt ===POINT(" + neuLon + " " + neuLat + ")===");

		if (	!loesungshausnummerSelbeSeiteWieSuchhausnummer 
				&&	(strasseLonLat != "")) {
////V1.5postgisif ( 1 == 0) {
				// Sonderfall es wurden Hausnummern von der gegenüberliegenden Straßenseite genommen, 
				// also Ziel-Punkt an Straße spiegeln
			var diffLon = parseFloat(lonAufStrasse - neuLon);
			var diffLat = parseFloat(latAufStrasse - neuLat);

			neuLon  += 2 * diffLon;
			neuLat  += 2 * diffLat;
			//console.log("andere-strassenseite bei 2-in-einer-reihe neues Objekt ===POINT(" 
			//	+ neuLon + " " + neuLat + ")===");
				//TODO hier erfolgt eine PUNKTSPIEGELUNG um Straßen-Schwerpunkt, das verfälscht u.U. stark
		}
		//console.log("neues Objekt nach Spiegelung wg. falscher Straßenseite ===POINT(" 
		//	+ neuLon + " " + neuLat + ")===");
	}

	// -------------------------------------- beide unter- oder oberhalb --------------------------------------
	// --------------------------------------------------------------------------------------------------------



		// Notanker: weil Stadt-Hausnummer nicht interpolierbar war, jetzt den Straßenschwerpunkt auf der Straße nehmen
/*
if ((neuLon == LONGUNSET) || (neuLat == LONGUNSET)) {
	console.log("WARNUNG: leider keine Interpolationsmöglichkeit gefunden für " 
		+ strasse + " " + hausnummerFehlend);
	neuLon = lonAufStrasse;
	neuLat = latAufStrasse;
}
*/

	if(neuLon != "")
		return "" + neuLon  + " "  + neuLat;
	else
		return "";
}
//---------------------------------------------------------------------------------------------
//calculateCoordinateForAMissingHousenumber
//=============================================================================================



//=============================================================================================
//                                gpx_ausgeben
// ---------------------------------------------------------------------------------------------
function gpx_ausgeben(request, response) {
	console.time("gpx_ausgeben");
	
	var params = {
		jobid: request.query["job_id"] || "",
		nichtexistierendehausnummernfiltern: request.query["nichtexistierendehausnummernfiltern"] || "nein"
	};

	for(var parami in params) {
		console.log("in auswertung.js/gpx_ausgeben: params["+parami+"]===" + params[parami] + "===");
	}
	
	return response.getClient(function(err, client, done) {
		if(err != undefined) {
			console.log("FEHLER bei pg.connect ...");
			console.log("Forts. "+err.toString());
		}
		
		
		// hol die nicht-existierenden Hausnummern, damit diese bei der GPX-Ausgabe unterdrückt oder gekennzeichnet werden
		var query_notexistinghousenumbers_string = "SELECT street, housenumber"
			+ " FROM notexisting_housenumbers, jobs, stadt, land WHERE"
			+ " jobs.id = $1 AND"
			+ " jobs.stadt_id = stadt.id AND"
			+ " jobs.land_id = land.id AND"
			+ " city like stadt.stadt AND"
			+ " country = land.land;";
		// TODO nextcheckdate aktiv berücksichtigen, ob evtl. zeitlich verfallen

		client.query({name: "gpx_ausgeben_1", text: query_notexistinghousenumbers_string, values: [params.jobid, params.landcode]}, function(error, notexistinghousenumbers_result) {

			var query_string = "select osm_id, strasse, hausnummer, osm_objektart, ST_X(point) as lon, ST_Y(point) as lat"
				+ " FROM auswertung_hausnummern AS ah, strasse AS s"
				+ " WHERE ah.job_id = $1"
				+ " AND ah.strasse_id = s.id"
//				+ " AND (ah.treffertyp = 's' OR ah.treffertyp = 'l')"
				+ " ORDER BY correctorder(strasse),hausnummer_sortierbar, hausnummer;";
	
			var waypoints = [];
			var maxwaypoints = 2000;	// limit load on calculation and output
	
			var query_hnr = client.query({name: "gpx_ausgeben_2", text: query_string, values: [params.jobid]});
			var gpxpuffer;

			var osmHnrobjekte = [];

			query_hnr.on("row",function(row) {
				var akt_osmobjektart = row.osm_objektart != null ? row.osm_objektart : "";
				var akt_lon = row.lon != null ? row.lon : "";
				var akt_lat = row.lat != null ? row.lat : "";
				//console.log("==> " + row.strasse + " " + row.hausnummer + " (" + row.lon + "/" + row.lat);
				osmHnrobjekte.push(new Housenumberobject(row.osm_id, row.strasse, row.hausnummer, "dummy", akt_osmobjektart, akt_lon, akt_lat));
			});

			query_hnr.on("end",function(result) {
				console.log("at query-end");
				console.log("at query-end after done, Count osmHnrobjekte: " + osmHnrobjekte.length);
				var hnrobjekteAktStrasse = [];
				var vorherigeStrasse = "";
				var aktStrasseAnzahlOffeneHnr = 0;
				var aktStrasseAnzahlVorhandeneHnr = 0;

					// dirty: pseudo Hnr-Objekt ans Ende setzen, damit alle Strassen abgearbeitet werden
				osmHnrobjekte.push(new Housenumberobject("-4711", "xyzblubblu", "9876", "dummy", "", "", ""));

				var countwaypoints = 0;
				
				for(var osmHnrobjekteIndex = 0; osmHnrobjekteIndex < osmHnrobjekte.length; osmHnrobjekteIndex++) {
					var aktHnrobjekt = osmHnrobjekte[osmHnrobjekteIndex];
						// if act housenumber is in another street than last ones, work on previous street housenumbers in array hnrobjekteAktStrasse
					//console.log("Staßenwechseltest: aktHnrobjekt.strasse ===" + aktHnrobjekt.strasse + "===, vorherigeStrasse ===" + vorherigeStrasse + "=== ...");

					if((aktHnrobjekt.strasse != vorherigeStrasse)) {
						//console.log(" ok, Straßenwechsel  von ===" + vorherigeStrasse + "=== nach ===" +  aktHnrobjekt.strasse
						//	+ "  Zahlen: offene: " + aktStrasseAnzahlOffeneHnr  + "   mit lat-lon: " + aktStrasseAnzahlVorhandeneHnr);
						if((aktStrasseAnzahlOffeneHnr > 0) && (aktStrasseAnzahlVorhandeneHnr > 0)) {
							//console.log(" ok, Straße hat offene Hausnummern !!!");
							for(var hnrobjekteAktStrasseIndex = 0; hnrobjekteAktStrasseIndex < hnrobjekteAktStrasse.length; hnrobjekteAktStrasseIndex++) {
								var aktHnrobjektAktStrasse = hnrobjekteAktStrasse[hnrobjekteAktStrasseIndex];
								//console.log("Street ===" + aktHnrobjektAktStrasse.strasse + "===, Hnr. ===" + aktHnrobjektAktStrasse.hausnummer 
								//	+ "===, lon ===" + aktHnrobjektAktStrasse.lon + ", " + aktHnrobjektAktStrasse.lat + "=== ...");
								if((aktHnrobjektAktStrasse.lon != undefined) && (aktHnrobjektAktStrasse.lon != "") 
										&& (aktHnrobjektAktStrasse.osm_objektart != undefined) && (aktHnrobjektAktStrasse.osm_objektart != "")) {
									continue;
								}
								var strasseLonlat = "";
								var ermittelteAdresspositionstring = calculateCoordinateForAMissingHousenumber(vorherigeStrasse, 
									strasseLonlat, aktHnrobjektAktStrasse.hausnummer, hnrobjekteAktStrasse, hnrobjekteAktStrasse.length);
								if (ermittelteAdresspositionstring != "") {
									var tempstring = 
										ermittelteAdresspositionstring.substring(0, ermittelteAdresspositionstring.indexOf(" "));
									//console.log("auf-strasse lon (string) ===" + tempstring + "===");
									var ermittelteLon = tempstring;
		
									tempstring = ermittelteAdresspositionstring.substring(ermittelteAdresspositionstring.indexOf(" ") + 1);
									//console.log("auf-strasse lat (string) ===" + tempstring + "===");
									var ermittelteLat = tempstring;
		
									if (ermittelteLon != "4711.0") {
										var waypoint = {};
										waypoint.lon = ermittelteLon;
										waypoint.lat = ermittelteLat;
										waypoint.strasse = vorherigeStrasse;
										waypoint.hausnummer = aktHnrobjektAktStrasse.hausnummer;
										//waypoint.source = "OSMapprox";
										if(countwaypoints < maxwaypoints) {
											waypoints.push(waypoint);
											countwaypoints++;
										}
									}
								}							
							}
						}
							// reset all variables for collecting housenumbers for next street
						hnrobjekteAktStrasse = [];
						vorherigeStrasse = aktHnrobjekt.strasse;
						aktStrasseAnzahlOffeneHnr = 0;
						aktStrasseAnzahlVorhandeneHnr = 0;
					}
						// collect all housenumber into array for one street
					hnrobjekteAktStrasse.push(aktHnrobjekt);
					if((aktHnrobjekt.lon == undefined) || (aktHnrobjekt.lon == "") || (aktHnrobjekt.osm_objektart == ""))
						aktStrasseAnzahlOffeneHnr++;
					else
						aktStrasseAnzahlVorhandeneHnr++;

					//console.log("  Anzahl im Array: " + hnrobjekteAktStrasse.length + ",   " + aktHnrobjekt.strasse + " " + aktHnrobjekt.hausnummer + "    ("
					//	+ aktHnrobjekt.lon + "/" + aktHnrobjekt.lat + ")    aktStrasseOffeneHausnummern: " + aktStrasseOffeneHausnummern);
				}
				response.setHeader("Content-Type", "text/plain; charset=utf-8");
				response.render("gpx_ausgeben.html", {waypoints: waypoints});
		
				console.timeEnd("gpx_ausgeben");
				done();
			});
		});
	});
}
//---------------------------------------------------------------------------------------------
//gpx_ausgeben
// =============================================================================================



	// =============================================================================================
	//                                show
	// ---------------------------------------------------------------------------------------------
function show(request, response) {
	console.time("showevaluation");
	
	var auswertungsdaten = {
		jobs: [],
		summe_nurstadt: 0,
		summe_nurosm: 0,
		summe_identisch: 0,
		summe_nurliste: 0,
		summe_soll: 0
	}
	
	var params = {
		countrycode: request.query["country"] || "",
		municipality: request.query["municipality"] || "",
		jobidliste: request.query["job_ids"] || [],
		farbig: request.query["ausgabefarbig"] == "true" || true,
		nursummen: request.query["nursummen"] == "true" || false,
		linktyp: request.query["linktyp"] || "osmkartevoll",
		unterdrueckfertigestrassen: request.query["unterdrueckfertigestrassen"] || "nein",
		unterdrueckspalten: request.query["unterdrueckspalten"] == "jaidentische" || false,
		hnrausgabe_gerade_ungerade: request.query["hnrausgabe_gerade_ungerade"] == "true" || false,
		editieren: request.query["edit"] == "ja" || false
	};

	for(var parami in params) {
		console.log("in auswertung/show vor checks: params["+parami+"]===" + params[parami] + "===");
	}

	if(!params.municipality) {
		var fehlertitel = "Auswertung einer Gemeinde: Stadt nicht ausgewählt";
		var meldetext = "Es wurde keine Stadt ausgewählt, die ausgewertet werden soll. bitte die Auswahl neu treffen.";
		var fortsetzurl = "/housenumbers/selectmunicipality"; 
		response.render("evaluation_missingparameters.html", {title: fehlertitel, fehlermeldung: meldetext, fortsetzurl: fortsetzurl});
		return;
	}

	if(typeof params.jobidliste == "string") {
		params.jobidliste = [params.jobidliste];
	}

	for(var parami in params) {
		console.log("nach checks in auswertung/show: params["+parami+"]===" + params[parami] + "===");
	}
	
	// Manipulation des Edit-Parameters
	var queryCopy = JSON.parse(JSON.stringify(request.query));
	queryCopy.edit = "ja";
	auswertungsdaten.url_edit = "/housenumbers/showevaluation?" + querystring.stringify(queryCopy);
	queryCopy.edit = "nein";
	auswertungsdaten.url_noedit = "/housenumbers/showevaluation?" + querystring.stringify(queryCopy);
	
	// TODO weitere Parameter auslesen
	// TODO aktuellen Stand der DB zeigen durch auslesen state.txt

	var query_string = "SELECT osm_id as osm_relation_id,"
		+ " ST_X(ST_Transform(ST_Centroid(gebiete.polygon),4326)) AS lon,"
		+ " ST_Y(ST_Transform(ST_Centroid(gebiete.polygon),4326)) AS lat,"
		+ " jobs.id AS job_id,"
		+ " jobs.jobname AS jobname,"
		+ " land.land, land.countrycode,"
		+ " stadt.stadt,"
		+ " stadt.officialgeocoordinates,"
		+ " stadt.sourcelist_url AS sourcelist_url,"
		+ " stadt.sourcelist_copyrighttext AS sourcelist_copyrighttext,"
		+ " stadt.sourcelist_useagetext AS sourcelist_useagetext,"
		+ " to_char(stadt.sourcelist_contentdate, 'DD.MM.YYYY') AS sourcelist_contentdate,"
		+ " to_char(stadt.sourcelist_filedate, 'DD.MM.YYYY') AS sourcelist_filedate,"
		+ " evaluation.tstamp,"
		+ " evaluation.osmdb_tstamp,"
		+ " stadt.parameters->'listcoordosmuploadable' AS paralistcoordosmuploadable,"
		+ " stadt.parameters->'listcoordforevaluation' AS paralistcoordforevaluation"
		+ " FROM"
		+ " jobs" 
		+ " JOIN gebiete ON jobs.gebiete_id = gebiete.id"
		+ " JOIN land ON jobs.land_id = land.id"
		+ " JOIN stadt ON jobs.stadt_id = stadt.id"
		+ " LEFT JOIN"
		+ "   (SELECT DISTINCT ON (job_id) * FROM evaluations"
		+ "    WHERE number_target > 0"
		+ "    ORDER BY job_id, id DESC) evaluation"
		+ " ON jobs.id = evaluation.job_id"
		+ " WHERE"
		+ " land.countrycode = $1 AND stadt.stadt = $2 AND jobs.id = ANY($3::int[])"
		+ " ORDER BY correctorder(jobs.jobname)";

	console.log("query for evaluation ===" + query_string + "===");
	console.log("parameter 1 ===" + params.countrycode + "===");
	console.log("parameter 2 ===" + params.municipality + "===");
	console.log("parameter 3 ===" + params.jobidliste + "===");
	response.simpleQuery({name: "auswertung_execute_1", text: query_string, values: 
		[params.countrycode, params.municipality, params.jobidliste]}, function(j_error, j_result) {
	
		async.each(j_result.rows, function(j_row, callback) {
			var paralistcoordforevaluation = 'no';
			if(j_row.paralistcoordforevaluation != undefined)
				paralistcoordforevaluation = j_row.paralistcoordforevaluation;
			else if(	(j_row.officialgeocoordinates != undefined)
					&&	(j_row.officialgeocoordinates == "y"))
				paralistcoordforevaluation = "yes";
				
			var paralistcoordosmuploadable = 'no';
			if(j_row.paralistcoordosmuploadable != undefined)
				paralistcoordosmuploadable = j_row.paralistcoordosmuploadable;
			else if(	(j_row.officialgeocoordinates != undefined)
					&&	(j_row.officialgeocoordinates == "y"))
				paralistcoordosmuploadable = "yes";

			console.log("paralistcoordforevaluation ===" + paralistcoordforevaluation + "===");
			console.log("paralistcoordosmuploadable ===" + paralistcoordosmuploadable + "===");
			
			j_row.paralistcoordosmuploadable			
			var job = {
				job_id: j_row.job_id,
				gebiet_osm_id: -1 * parseInt(j_row.osm_relation_id),
				jobname: j_row.jobname,
				countrycode: j_row.countrycode,
				land: j_row.land,
				stadt: j_row.stadt,
				paralistcoordosmuploadable: paralistcoordosmuploadable,
				paralistcoordforevaluation: paralistcoordforevaluation,
				sourcelist_url: j_row.sourcelist_url,
				sourcelist_copyrighttext: j_row.sourcelist_copyrighttext,
				sourcelist_useagetext: j_row.sourcelist_useagetext,
				sourcelist_contentdate: j_row.sourcelist_contentdate,
				sourcelist_filedate: j_row.sourcelist_filedate,
				lon: j_row.lon,
				lat: j_row.lat,
				tstamp: j_row.tstamp,
				dbtstamp: j_row.osmdb_tstamp,
				strassen: [],
				summe_nurstadt: 0,
				summe_nurosm: 0,
				summe_identisch: 0,
				summe_nurliste: 0,
				summe_soll: 0
			};
			auswertungsdaten.jobs.push(job);

			// TODO heute ende
			// TODO aktuell - das Array notexistinghousenumbers_result weiter unten bei treffertyp i und s berücksichtigen und einblenden bzw. ausblenden
			var query_hnr_string = "SELECT"
				+ "   auswertung_hausnummern.id AS auswertung_hausnummern_id,"
				+ "   strasse.strasse,"
				+ "   strasse.id AS strasse_id,"
				+ "   auswertung_hausnummern.hausnummer,"
				+ "   auswertung_hausnummern.treffertyp,"
				+ "   auswertung_hausnummern.osm_objektart,"
				+ "   auswertung_hausnummern.osm_id,"
				+ "   auswertung_hausnummern.hausnummer_bemerkung,"
				+ "   jobs_strassen.osm_ids AS osm_strassen_ids,"
				+ "   ST_X(ST_Transform(ST_ClosestPoint(jobs_strassen.linestring,ST_Centroid(jobs_strassen.linestring)),4326)) AS lon,"
				+ "   ST_Y(ST_Transform(ST_ClosestPoint(jobs_strassen.linestring,ST_Centroid(jobs_strassen.linestring)),4326)) AS lat,"
				+ "   ST_X(point) AS hnr_lon,"
				+ "   ST_Y(point) AS hnr_lat,"
				+ "   auswertung_hausnummern.pointsource,"
				+ "   ignore.housenumber IS NOT NULL AS ignoriert,"
				+ "   ignore.reason AS ignoriert_begruendung,"
				+ "   to_char(ignore.nextcheckdate, 'DD.MM.YYYY') AS ignoriert_nextcheckdate"
				+ " FROM auswertung_hausnummern"
				+ " JOIN strasse"
				+ "   ON auswertung_hausnummern.strasse_id = strasse.id"
				+ " JOIN jobs"
				+ "   ON auswertung_hausnummern.job_id = jobs.id AND"
				+ "      auswertung_hausnummern.land_id = jobs.land_id AND"
				+ "      auswertung_hausnummern.stadt_id = jobs.stadt_id"
				+ " LEFT JOIN jobs_strassen"
				+ "   ON auswertung_hausnummern.strasse_id = jobs_strassen.strasse_id AND"
				+ "      jobs.id = jobs_strassen.job_id"
				+ " JOIN gebiete"
				+ "   ON jobs.gebiete_id = gebiete.id"
				+ " JOIN land"
				+ "   ON auswertung_hausnummern.land_id = land.id"
				+ " LEFT JOIN (SELECT DISTINCT ON (street, housenumber) *"
				+ "            FROM notexisting_housenumbers"
				+ "            WHERE country = $2"
				+ "            AND city = $3"
				+ "            AND current_date < nextcheckdate"
				+ "            ORDER BY street, housenumber, nextcheckdate DESC) ignore"
				+ "   ON strasse.strasse = ignore.street AND"
				+ "      land.land = ignore.country AND"
				+ "      auswertung_hausnummern.hausnummer = ignore.housenumber"
				+ " WHERE"
				+ "   jobs.id = $1"
				+ " ORDER BY correctorder(strasse.strasse), hausnummer_sortierbar;";

			var strasse;

			console.log("hausnummern-query ===" + query_hnr_string + "===");
			console.log("parameter 1 ===" + j_row.job_id + "===");
			console.log("parameter 2 ===" + j_row.land + "===");
			console.log("parameter 3 ===" + j_row.stadt + "===");
			console.time("hnr-query");
			response.simpleQuery({name: "auswertung_execute_2", text: query_hnr_string, 
				values: [j_row.job_id, j_row.land, j_row.stadt]}, 
				function(hnr_error, hnr_result) {
				if (hnr_error)
					return callback(hnr_error);

				console.timeEnd("hnr-query");
				
				hnr_result.rows.forEach(function(hnr_row) {
					if (!strasse || strasse.strasse_id != hnr_row.strasse_id) {
						strasse = {
							name: hnr_row.strasse,
							strasse_id: hnr_row.strasse_id,
							//strassenids: [], // at 2015-01-25 deactivated, because roads missing in osm will not be shown otherwise							
							strassenids: hnr_row.osm_strassen_ids ? hnr_row.osm_strassen_ids.split(",") : [],
							lon: hnr_row.lon,
							lat: hnr_row.lat,
							summe_identisch: 0,
							summe_nurstadt: 0,
							summe_nurosm: 0,
							summe_nurliste: 0,
							summe_soll: 0,
							hausnummern_nurstadt: [],
							hausnummern_nurosm: [],
							hausnummern_identisch: [],
							hausnummern_nurliste: [],
							hausnummern_nurstadt_gerade: [],
							hausnummern_nurstadt_ungerade: [],
							hausnummern_nurosm_gerade: [],
							hausnummern_nurosm_ungerade: [],
							hausnummern_identisch_gerade: [],
							hausnummern_identisch_ungerade: [],
							hausnummern_nurliste_gerade: [],
							hausnummern_nurliste_ungerade: []
						};
						job.strassen.push(strasse);
					}
					
					var hausnummer = {
						osm_objektart: hnr_row.osm_objektart,
						osm_id: hnr_row.osm_id,
						hausnummer: hnr_row.hausnummer,
						koord_lon: hnr_row.hnr_lon,
						koord_lat: hnr_row.hnr_lat,
						koord_quelle: hnr_row.pointsource,
						hausnummer_bemerkung: hnr_row.hausnummer_bemerkung,
						ignoriert: hnr_row.ignoriert,
						ignoriert_begruendung: hnr_row.ignoriert_begruendung == undefined ? undefined : hnr_row.ignoriert_begruendung.replace(/[\r\n\f]/gi,""),
						ignoriert_nextcheckdate: hnr_row.ignoriert_nextcheckdate
					};
					
					var liste;
					var suffix = parseInt(hnr_row.hausnummer) % 2 == 0 ? "gerade" : "ungerade";

					if(hnr_row.treffertyp == "i") {
						strasse.summe_identisch++;
						strasse.summe_soll++;
						liste = "identisch";
					} else if(	(hnr_row.treffertyp == "l") 
							|| 	(hnr_row.treffertyp == "s")) {
						if (!hausnummer.ignoriert) {
							strasse.summe_soll++;
							strasse.summe_nurstadt++;
						}
						liste = "nurstadt";
					} else if(hnr_row.treffertyp == "o") {
						strasse.summe_nurosm++;
						liste = "nurosm";
					} else {
						console.log("Error, Error: treffertyp with unknown value ===" + hnr_row.treffertyp + "===, auswertung_hausnummern id was " + hnr_row.auswertung_hausnummern_id);
					}
					
					strasse["hausnummern_" + liste].push(hausnummer);
					strasse["hausnummern_" + liste + "_" + suffix].push(hausnummer);
				});
				console.timeEnd("hnr-query");

				job.strassen.forEach(function(strasse) {
					// Straße fertigstellen
					auswerten(strasse);
					if (params.hnrausgabe_gerade_ungerade) {
						strasse.hausnummern_nurstadt = strasse.hausnummern_nurstadt_ungerade.concat(strasse.hausnummern_nurstadt_gerade);
						strasse.hausnummern_nurosm = strasse.hausnummern_nurosm_ungerade.concat(strasse.hausnummern_nurosm_gerade);
						strasse.hausnummern_identisch = strasse.hausnummern_identisch_ungerade.concat(strasse.hausnummern_identisch_gerade);
					}

					delete strasse.hausnummern_nurstadt_gerade;
					delete strasse.hausnummern_nurstadt_ungerade;
					delete strasse.hausnummern_nurosm_gerade;
					delete strasse.hausnummern_nurosm_ungerade;
					delete strasse.hausnummern_identisch_gerade;
					delete strasse.hausnummern_identisch_ungerade;

					strasse.flag_strassefiltern = false;
					if(params.unterdrueckfertigestrassen == 'jaallevollstaendig') {
						if(strasse.summe_soll == strasse.summe_identisch) {
							strasse.flag_strassefiltern = true;
						}
					}
					if(params.unterdrueckfertigestrassen == 'javollstaendigohnenurosm') {
						if((strasse.summe_soll == strasse.summe_identisch) && (strasse.summe_nurosm == 0)) {
							strasse.flag_strassefiltern = true;
						}
					}

					// Auf Job addieren
					job.summe_nurstadt += strasse.summe_nurstadt;
					job.summe_identisch += strasse.summe_identisch;
					job.summe_nurosm += strasse.summe_nurosm;
					job.summe_nurliste += strasse.summe_nurliste;
					job.summe_soll += strasse.summe_soll;
				});
				
				// Job fertigstellen
				auswerten(job);
				
				// Auf Auswertung addieren
				auswertungsdaten.summe_nurstadt += job.summe_nurstadt;
				auswertungsdaten.summe_nurosm += job.summe_nurosm;
				auswertungsdaten.summe_identisch += job.summe_identisch;
				auswertungsdaten.summe_nurliste += job.summe_nurliste;
				auswertungsdaten.summe_soll += job.summe_soll;
				
				callback();
			});
		}, function(error) {
			// Auswertung fertigstellen
			auswerten(auswertungsdaten);
	
			response.render(params.nursummen ? "evaluation_result_summary.html" : "evaluation_result.html", 
				{params: params, auswertungsdaten: auswertungsdaten});

			console.timeEnd("showevaluation");
		});
	});
}

function auswerten(objekt) {
	if (objekt.summe_soll > 0) {
		var abdeckung = objekt.summe_identisch / objekt.summe_soll;
		objekt.abdeckung = Math.floor(1000 * abdeckung) / 10;
		if (abdeckung == 1.0)
			objekt.abdeckung_class = "abdeck_100";
		else if (abdeckung >= 0.95 && abdeckung < 1.0)
			objekt.abdeckung_class = "abdeck_95";
		else if (abdeckung >= 0.85 && abdeckung < 0.95)
			objekt.abdeckung_class = "abdeck_85";
		else if (abdeckung >= 0.75 && abdeckung < 0.85)
			objekt.abdeckung_class = "abdeck_75";
		else if (abdeckung >= 0.5 && abdeckung < 0.75)
			objekt.abdeckung_class = "abdeck_50";
		else if (abdeckung >= 0.25 && abdeckung < 0.5)
			objekt.abdeckung_class = "abdeck_25";
		else if (abdeckung >= 0.0 && abdeckung < 0.25)
			objekt.abdeckung_class = "abdeck_0";
		else
			objekt.abdeckung_class = "abdeck_invalid";
	} else {
		objekt.abdeckung = "-";
		objekt.abdeckung_class = "abdeck_0";
	}
}



exports.selectmunicipality = selectmunicipality;
exports.selectevaluation = selectevaluation;
exports.gpx_ausgeben = gpx_ausgeben;
exports.offizielle_koordinaten_ausgeben = offizielle_koordinaten_ausgeben;
exports.offizielle_koordinaten_abgleichen = offizielle_koordinaten_abgleichen;
exports.show = show;
