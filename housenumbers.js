	// project specific references
var ApplicationConfiguration = require("./housenumbers/Applicationconfiguration");
var evaluation = require("./housenumbers/evaluation");
var housenumber = require("./housenumbers/housenumber");
/*
					var theo_auswertung = require("./housenumbers/theoauswertung");
					var grafikanforderung = require("./housenumbers/grafikanforderung");
					var historischeentwicklung = require("./housenumbers/historischeentwicklung");
					var notexisting_housenumbers_insert = require("./notexisting_housenumbers/insert_new"); 
					var notexisting_housenumbers_get = require("./notexisting_housenumbers/get"); 
					var strasse = require("./housenumbers/strasse");
					var statistik = require("./housenumbers/statistik");
					var missionplaning = require("./housenumbers/missionplaning");
					var api_getmissingstreetnumbers = require("./api/getmissingstreetnumbers");
					var jobqueue = require("./housenumbers/jobqueue");
					var state = require("./housenumbers/state");
*/

	// standard node.js addons
var express = require("express");
var swig = require("swig");
var pg = require("pg");
var I18n = require("i18n-2");
var fs = require('fs');

	// definition of frontend-urls (up to now in german, sorry)
//TODO either use english urls or multi language urls
	// CAUTION: cannot be changed here, because urls are hardcoded in several code functions

var handle = {}
handle["/en/selectmunicipality"] = evaluation.selectmunicipality;
handle["/de/auswertung_auswahlort"] = evaluation.selectmunicipality;
handle["/de/auswertung_auswahldetails"] = evaluation.selectevaluation;
handle["/en/selectevaluation"] = evaluation.selectevaluation;
handle["/en/showevaluation"] = evaluation.show;
handle["/de/gpx_ausgeben"] = evaluation.exportgpx;
handle["/en/exportgpx"] = evaluation.exportgpx;
handle["/offizielle_koordinaten_ausgeben"] = evaluation.exportofficialgeocoordinates;
handle["/en/exportofficialgeocoordinates"] = evaluation.exportofficialgeocoordinates;
handle["/de/hausnummer_details"] = housenumber.details;
handle["/en/housenumber_details"] = housenumber.details;
handle["/de/hausnummer_ignorieren"] = housenumber.ignore;
handle["/en/housenumber_ignore"] = housenumber.ignore;
handle["/de/hausnummer_ignorierteliste"] = housenumber.ignorelist;
handle["/en/housenumber_ignorelist"] = housenumber.ignorelist;
handle["/de/hausnummer_reaktivieren"] = housenumber.reactivate;
handle["/en/housenumber_reactivate"] = housenumber.reactivate;
/*
					handle["/offizielle_koordinaten_abgleichen"] = evaluation.offizielle_koordinaten_abgleichen;

					handle["/karte_auswahlort"] = grafikanforderung.ort_dialog;
					handle["/theoreticalevaluation"] = grafikanforderung.theoevaluation;
					handle["/historischeentwicklung/grafik"] = historischeentwicklung.show;
					handle["/notexisting_housenumbers/insert_new"] = notexisting_housenumbers_insert.insert_new;
					handle["/notexisting_housenumbers/get_around_pos"] = notexisting_housenumbers_get.around_pos;
					handle["/strasse/details"] = strasse.details;
					handle["/strasse/ignorieren"] = strasse.ignorieren;
					handle["/strasse/ignorierte_liste"] = strasse.ignorierte_liste;
					handle["/strasse/reaktivieren"] = strasse.reaktivieren;
					handle["/statistik"] = statistik.show;
					handle["/mission_show"] = missionplaning.show;
					handle["/mission_route"] = missionplaning.route;
					handle["/nextopenjobs"] = jobqueue.nextOpenJobs;
					handle["/nextopenjobshierarchy"] = jobqueue.nextOpenJobsHierarchy;
					handle["/evaluationinstantrequest"] = jobqueue.requestInstantJob;
					handle["/theoretische_auswertung_anzeigen"] = theo_auswertung.show;
					handle["/state"] = state.show;

					handle["/api/getmissingstreetnumbers"] = api_getmissingstreetnumbers.request;
*/


global.configuration = ApplicationConfiguration();

console.log(" in hausnummern.js nach Konfigurations-setzen ==="+global.configuration.servername+"===");
console.log("in hausnummern.js nach Konfiguration-setzen global.configuration.frontend_serverport ==="+global.configuration.frontend_serverport+"===");

var app = express();

app.configure(function () {
	I18n.expressBind(app, {
		// setup some locales - other locales default to en silently
		locales: ['de', 'en', 'pt-br', 'pt'],
    	extension: '.json',		// setting extension of json files - defaults to '.json' (you might want to set this to '.js' according to webtranslateit)
    	devMode: true,
        updateFiles: true,
        request: true,
        query: true,
        cookieName: 'language',
        directory: __dirname + '/locales'
    });
});

app.use(express.cookieParser());


// URL-Ausgabe
app.use(function(request, response, next) {
	var show_params = false;
	var show_cookies = false;
	//console.log("Aufruf:", request.path);

	if(request.param && show_params) {
		console.log("request.param beginn ...");
		for(var pari in request.param) {
			console.log(" request.params ["+pari+"] ==="+request.param[pari]+"===");
		}
		console.log("request.param ende!");
	}

	if(request.cookies && show_cookies) {
		console.log("Cookies begin ...");
		for(var cooki in request.cookies) {
			console.log("cookie ["+cooki+"] ==="+request.cookies[cooki]+"===");
		}
		console.log("Cookies end!");
	}
	
	next();
});

//This is how you'd set a locale from req.cookies.
//Don't forget to set the cookie either on the client or in your Express app.
app.use(function(request, response, next) {
 console.log("==========================================================");
 console.log("URL-Aufruf:", request.path);
 request.i18n.setLocaleFromCookie();
 //console.log("actual language in request: " + request.i18n.getLocale());
 //console.log("in app.configure danach isPreferredLocale ==="+request.i18n.isPreferredLocale()+"===");
 next();
});


// Statische Seiten
app.use(express.static(__dirname + "/public_html"));

// Dynamische Seiten
app.engine("html", swig.renderFile);
app.set("views", __dirname + '/housenumbers/templates');
app.use(app.router);

app.get('/grafikdarstellung/anzeige.html', function(request, response) {
	response.redirect('/housenumbers/anzeige_dynamisch.html');
});
app.get('/grafikdarstellung/anzeige_dynamisch.html', function(request, response) {
	response.redirect('/housenumbers/anzeige_dynamisch.html');
});

app.get('/theretischeabdeckung.html', function(request, response) {
	response.redirect('/housenumbers/theoretischeabdeckung.html');
//TODO redirect prüfen
});

var getClient = function(callback) {
	pg.connect(global.configuration.db_application_connection, callback);
};

var getClient_listofstreets = function(callback) {
	pg.connect(global.configuration.db_application_listofstreets_connection, callback);
};

var simpleQuery = function(query, callback) {
	getClient(function(error, client, done) {
		if (error) {
			callback(error);
		} else {
			client.query(query, function(error, result) {
				done();
				callback(error, result);
			});
		}
	});
};

var simpleQuery_listofstreets = function(query, callback) {
	getClient_listofstreets(function(error, client, done) {
		if (error) {
			callback(error);
		} else {
			client.query(query, function(error, result) {
				done();
				callback(error, result);
			});
		}
	});
};

app.use(function(request, response, next) {
	var handler = handle["/" + request.i18n.getLocale() + request.path];
	if(! handler) {
		handler = handle["/en" + request.path];
		if(! handler) {
			console.log("didn't get default language url (en) for request ===" + request.path + "===, with langprefix ===" + "/en" + request.path + "===");
			handler = handle[request.path];
		} else {
			console.log("ok, found default language url (en) for request ===" + request.path);
		}
	} else {
		console.log("ok, found language-specific url (" + request.i18n.getLocale() + ") for request ===" + request.path);
	}
	if (handler) {
		response.getClient = getClient;
		response.simpleQuery = simpleQuery;
		response.simpleQuery_listofstreets = simpleQuery_listofstreets;
		handler(request, response);
	} else {
		console.log("Upps, no handler for url ===" + request.path);
		next();
	}
});

//start
app.use(function(request, response, next) {
	var requestfilename = __dirname + "/housenumbers/templates" + request.path;
	console.log(request.path + " until now not found, now try to find pseudo static file ===" + requestfilename + "===  ...");
	console.log("request.url ===" + request.url + "===");

	fs.readFile(requestfilename, function(err,filecontent) {
		if(filecontent != undefined) {
			var dateiinhalt = filecontent;	// filecontent ist offenbar Object, aber Struktur unklar	
			response.render(requestfilename);
		} else {
			next();
		}
	});
});
// end

app.use(function(request, response, next) {
	console.log(request.path + " Datei nicht gefunden");
	next();
});

app.listen(global.configuration.frontend_serverport);
