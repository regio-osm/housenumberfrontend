// original filename from private repo: /housenumbers/statistik.js; version as of 2017-06-25

var async = require("async");

/*
 * Query to see the fulfilled for every german state
 * select substring(gemeinde_id for 2 from 1),count(te.*),sum(anzahl_osmadressen),sum(theo_anzahl_adressen),100*sum(anzahl_osmadressen)/sum(theo_anzahl_adressen) from theoeval201410 as te where land = 'Bundesrepublik Deutschland' group by substring(gemeinde_id for 2 from 1) order by substring(gemeinde_id for 2 from 1);
 * 
 *  V0.1, 03.10.2014, Dietmar Seifert
*/


	// =============================================================================================
	//                                show
	// ---------------------------------------------------------------------------------------------
function show(request, response) {
	console.time("statistik/show");
	
	var auswertungsdaten = {
		staedte: [],
		summe_nurstadt: 0,
		summe_nurosm: 0,
		summe_identisch: 0,
		summe_nurliste: 0,
		summe_soll: 0
	}
	
	var params = {
		land: request.query["land"] || "Bundesrepublik Deutschland"
	};

	for(var parami in params) {
		console.log("in statistik/show vor checks: params["+parami+"]===" + params[parami] + "===");
	}

	var query_string = "SELECT land, correctorder(stadt), stadt, officialkeys_id AS gemeinde_id " +
		", count(sh.*) AS anzahladressen " + 
		"FROM stadt_hausnummern AS sh " +
		"JOIN stadt AS s ON sh.stadt_id = s.id " +
		"JOIN land AS l ON sh.land_id = l.id" +
		"WHERE land = $1 " +
		"GROUP BY land, stadt, officialkeys_id " +
		"ORDER BY correctorder(stadt);";
	console.log("query_string stadt_hausnummern ===" + query_string + "===");

	response.simpleQuery({name: "statistik_show", text: query_string, values: [params.land]}, 
	function(stadthausnummern_error, stadthausnummern_result) {
	
		async.each(stadthausnummern_result.rows, function(stadthausnummern_row, callback) {

			var stadt = {
				land:				stadthausnummern_row.land,
				stadt:				stadthausnummern_row.stadt,
				gemeinde_id:		stadthausnummern_row.gemeinde_id,
				anzahladressen:		stadthausnummern_row.anzahladressen,
				bevoelkerungszahl:	0,
				flaechekm2:			0
			};
			auswertungsdaten.staedte.push(stadt);

			var query_hnr_string = "SELECT ags, name_unique AS name, bevoelkerungszahl, flaechekm2 " +
				"FROM officialkeys "+ 
				"WHERE ags = $1;";

			console.log("query officialkeys ===" + query_hnr_string + "===");
			console.time("officialkeys-query");
			response.simpleQuery_listofstreets({name: "officialkeys_execute", text: query_hnr_string, values: [stadthausnummern_row.gemeinde_id]}, function(hnr_error, hnr_result) {
				if (hnr_error)
					return callback(hnr_error);

				console.timeEnd("officialkeys-query");

				hnr_result.rows.forEach(function(hnr_row) {
					stadt.bevoelkerungszahl = hnr_row.bevoelkerungszahl;
					stadt.flaechekm2 = hnr_row.flaechekm2;
					console.log("result für Gemeinde ===" + hnr_row.name + "===  ags ===" + hnr_row.ags + "===  bevoelkerungszahl ==="+stadt.bevoelkerungszahl + "=== flaeche ===" + stadt.flaechekm2 + "===");
					console.log(" (forts. result)  akt stadt-objekt: .stadt ===" + stadt.stadt + "===  gemeinde_id ===" + stadt.gemeinde_id + "===");
				});
				callback();
			});
		}, function(error) {
			console.log("ok, after async angekommen.");
			response.render("statistics_execute.html", {params: params, auswertungsdaten: auswertungsdaten});
			console.timeEnd("statistik/show");

		});
	});
}

exports.show = show;
