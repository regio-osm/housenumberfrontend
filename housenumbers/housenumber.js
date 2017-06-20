// original filename from private repo: /housenumbers/hausnummer.js; version as of 2017-06-18


	// =============================================================================================
	//					show all housenumbers in a street (optionally to ignore)
	// ---------------------------------------------------------------------------------------------
function details(request, response) {
	console.time("housenumber/details");
	
	var params = {
		jobid: request.query["job_id"] || "",
		streetid: request.query["street_id"] || ""
	};

	for(var parami in params) {
		console.log("in hausnummer.js/details: params["+parami+"]===" + params[parami] + "===");
	}

	var query_string = "SELECT land, countrycode, stadt, strasse, hausnummer as nummer, objektart, osm_objektart, osm_id " +
		"FROM auswertung_hausnummern AS ah JOIN jobs ON ah.job_id = jobs.id " +
		"JOIN land ON jobs.land_id = land.id " +
		"JOIN stadt ON jobs.stadt_id = stadt.id " +
		"JOIN strasse ON ah.strasse_id = strasse.id " +
		"WHERE " +
		"ah.treffertyp = 'l' AND " +
		"ah.job_id = $1 AND " +
		"ah.strasse_id = $2 "+ 
		"ORDER BY hausnummer_sortierbar;";

	response.simpleQuery({name: "housenumberdetails", text: query_string, values: [params.jobid, params.streetid]}, 
	function(error, result) {
		console.log("in housenumber/details query was ===" + query_string + "===");
		console.log("  count of housenumber rows: " + result.rows.length);
		response.render("housenumber_details.html", {params: params, housenumbers: result && result.rows});

		console.timeEnd("housenumber/details");
	});
}

	// =============================================================================================
	//					store selected housenumbers to ignore for future evaluations
	// ---------------------------------------------------------------------------------------------
function ignore(request, response) {
	console.time("housenumber/ignore");
	
	var params = {
		createdby: "OSM-Hausnummernauswertung",
		street: request.query["street"] || null,
		municipality: request.query["municipality"] || null,
		country: request.query["country"] || null,
		countrycode: request.query["countrycode"] || null,
		jobid: request.query["job_id"] || "",
		reason: request.query["explicitreason"] || request.query["ignorereason"] || "",
		housenumbers: request.query["housenumber"] || [],
		ignoreduration: request.query["ignoreduration"] || null
	};

	//TODO bei Köln wäre auch Stadtbezirksangabe notwendig, weil Straße alleine nicht eindeutig

	if(typeof params.housenumbers == "string") {
		params.housenumbers = [params.housenumbers];
	}

	for(var parami in params) {
		console.log("in housenumber/ignore: params["+parami+"]===" + params[parami] + "===");
	}

	var insert_sql = "INSERT INTO notexisting_housenumbers"
		+ " (country, city, street, reason, nextcheckdate, created_by, housenumber)"
		+ " SELECT"
		+ " $1, $2, $3, $4, now() + $5 * interval '1 month', $6, unnest($7::text[]) RETURNING id;";
			
	var values = [params.country, params.municipality, params.street, params.reason, params.ignoreduration, 
	              params.createdby, params.housenumbers];
	
	response.simpleQuery({name: "housenumber_ignore", text: insert_sql, values: values}, function(error, result) {
		if(error) {
			console.log("SQL-Insert error ===" + error.toString() + "===");
			console.log("SQL-Insert statement =" + insert_sql + ", parameters " + "=" +
				params.country + "=, =" + params.municipality + "=, =" + params.street + "=, =" + 
				params.reason + "=, =" + params.ignoreduration + "=, =" + params.createdby + "=, =" +
				params.housenumbers + "=");
			response.render('housenumber_ignorestorefailed.html', {params: params, failtext: error.toString()});
		} else {
			response.render('housenumber_ignore.html', {params: params, housenumbers: result.rows});
		}
		
		console.timeEnd("housenumber/ignore");
	});
}

	//=============================================================================================
	//					show list of ignored housenumbers
	//---------------------------------------------------------------------------------------------
function ignorelist(request, response) {
	console.time("housenumber/ignorelist");

	var params = {
		jobid: 			request.query["job_id"] || "",
		countrycode:	request.query["country"] || "",
		municipality:	request.query["municipality"] || ""
	};

	for(var parami in params) {
		console.log("in housenumber/ignorelist: params["+parami+"]===" + params[parami] + "===");
	}

	var query_string = "SELECT jobname, ignore.id AS ignorierid, land.countrycode, " +
	"street AS strasse, housenumber AS hausnummer, reason, to_char(nextcheckdate, 'HH.MM.YYYY') as nextcheckdate " +
	"FROM auswertung_hausnummern " +
	"JOIN strasse ON auswertung_hausnummern.strasse_id = strasse.id " +
	"JOIN jobs ON auswertung_hausnummern.job_id = jobs.id AND " +
	"     auswertung_hausnummern.land_id = jobs.land_id AND " +
	"     auswertung_hausnummern.stadt_id = jobs.stadt_id " +
	"LEFT JOIN jobs_strassen " +
	"  ON auswertung_hausnummern.strasse_id = jobs_strassen.strasse_id AND " +
	"     jobs.id = jobs_strassen.job_id " +
	"JOIN gebiete ON jobs.gebiete_id = gebiete.id " +
	"JOIN stadt ON auswertung_hausnummern.stadt_id = stadt.id " +
	"JOIN land ON auswertung_hausnummern.land_id = land.id " +
	"JOIN (SELECT DISTINCT ON (street, housenumber) * " +
	"           FROM notexisting_housenumbers " +
	"           WHERE current_date < nextcheckdate " +
	"           ORDER BY street, housenumber, nextcheckdate DESC) ignore " +
	"  ON ignore.country = land.land AND " +
	"     ignore.city = stadt.stadt AND " + 
	"     ignore.street = strasse.strasse AND " +
	"     ignore.country = land.land AND " +
	"     ignore.housenumber = auswertung_hausnummern.hausnummer " +
	"WHERE jobs.id = $1 " +
	"ORDER BY correctorder(strasse.strasse), hausnummer_sortierbar;";

	console.log("query to get ignored streets ===" + query_string + "===");

	response.simpleQuery({name: "housenumber_ignorelist", text: query_string, values: [params.jobid]}, function(error, result) {
		if(error) {
			console.log("error, but no further information " + error.toString());
			response.writeHead(400, {"Content-Type": "text/plain"});
			response.write(error.toString());
			response.end();
		} else {
			response.render('housenumber_ignorelist.html', {params: params, 
				jobname: result && (result.rows.length > 0) && result.rows[0].jobname, housenumbers: result && result.rows});
		}
		console.timeEnd("housenumber/ignorelist");
	});
}


//=============================================================================================
//									reaktivieren
//---------------------------------------------------------------------------------------------
function reactivate(request, response) {
	console.time("housenumber/reactivate");

	var params = {
			jobid:			request.query["job_id"] || "",
			ignoreids:		request.query["ignoreid"] || [],
			countrycode:	request.query["country"] || "",
			municipality: 	request.query["municipality"] || ""
	};

	if(typeof params.ignoreids == "string" && params.ignoreids) {
		params.ignoreids = [params.ignoreids];
	}

	for(var parami in params) {
		console.log("in housenumber/reactivate: params["+parami+"]===" + params[parami] + "===");
	}

	var delete_sql = "DELETE FROM notexisting_housenumbers"
		+ " WHERE id IN (SELECT unnest($1::bigint[]));";
	console.log("delete_sql ===" + delete_sql + "===");

	response.simpleQuery({name: "housenumber_reactivate", text: delete_sql, values: [params.ignoreids]}, function(error, result) {
		if(error) {
			console.log("error, but no further information " + error.toString());
			response.writeHead(400, {"Content-Type": "text/plain"});
			response.write(error.toString());
			response.end();
			console.timeEnd("housenumber/reactivate");
		} else {
			var query_string = "SELECT jobname, ignore.id AS ignorierid, land.countrycode, " +
			"street AS strasse, housenumber AS hausnummer, reason, to_char(nextcheckdate, 'HH.MM.YYYY') as nextcheckdate " +
			"FROM auswertung_hausnummern " +
			"JOIN strasse ON auswertung_hausnummern.strasse_id = strasse.id " +
			"JOIN jobs ON auswertung_hausnummern.job_id = jobs.id AND " +
			"     auswertung_hausnummern.land_id = jobs.land_id AND " +
			"     auswertung_hausnummern.stadt_id = jobs.stadt_id " +
			"LEFT JOIN jobs_strassen " +
			"  ON auswertung_hausnummern.strasse_id = jobs_strassen.strasse_id AND " +
			"     jobs.id = jobs_strassen.job_id " +
			"JOIN gebiete ON jobs.gebiete_id = gebiete.id " +
			"JOIN stadt ON auswertung_hausnummern.stadt_id = stadt.id " +
			"JOIN land ON auswertung_hausnummern.land_id = land.id " +
			"JOIN (SELECT DISTINCT ON (street, housenumber) * " +
			"           FROM notexisting_housenumbers " +
			"           WHERE current_date < nextcheckdate " +
			"           ORDER BY street, housenumber, nextcheckdate DESC) ignore " +
			"  ON ignore.country = land.land AND " +
			"     ignore.city = stadt.stadt AND " + 
			"     ignore.street = strasse.strasse AND " +
			"     ignore.country = land.land AND " +
			"     ignore.housenumber = auswertung_hausnummern.hausnummer " +
			"WHERE jobs.id = $1 " +
			"ORDER BY correctorder(strasse.strasse), hausnummer_sortierbar;";
			console.log("query to get ignored streets ===" + query_string + "===");

			response.simpleQuery({name: "housenumber_ignorelist", text: query_string, values: [params.jobid]}, function(error, result) {
				if(error) {
					console.log("error, but no further information " + error.toString());
					response.writeHead(400, {"Content-Type": "text/plain"});
					response.write(error.toString());
					response.end();
				} else {
					response.render('housenumber_ignorelist.html', {params: params, housenumbers: result && result.rows});
					response.render('housenumber_ignorelist.html', {params: params, 
						jobname: result && (result.rows.length > 0) && result.rows[0].jobname, housenumbers: result && result.rows});
				}
				console.timeEnd("housenumber/reactivate");
			});
		}
	});
}


exports.details = details;
exports.ignore = ignore;
exports.ignorelist = ignorelist;
exports.reactivate = reactivate;
