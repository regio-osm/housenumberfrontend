// original filename from private repo: /housenumbers/street.js; version as of 2017-06-18

	// =============================================================================================
	//                                details
	// ---------------------------------------------------------------------------------------------
function details(request, response) {
	console.time("street/details");

	var params = {
		countrycode:	request.query["country"] || "",
		municipality: 	request.query["municipality"] || "",
		jobid:			request.query["job_id"] || "",
		streetid:		request.query["street_id"] || ""
	};

	//TODO offen: in DB prüfen, welche Semgmente zur aktuellen Straße bereits ignoriert wurden
	//TODO offen: weiteren Button anbieten, um eine ignorierte Straße wieder zu reaktivieren	
		
	var query_string = "SELECT regexp_split_to_table(nullif(osm_ids, ''), ',') AS id, strasse " +
		"FROM jobs_strassen JOIN strasse ON strasse_id = strasse.id " +
		"WHERE " +
		"job_id = $1 AND " +
		"strasse_id = $2;";

	response.simpleQuery({name: "street_details", text: query_string, values: [params.jobid, params.streetid]}, 
	function(error, result) {
		if(error) {
			console.log("error, but no further information " + error.toString());
			response.writeHead(400, {"Content-Type": "text/plain"});
			response.write(error.toString());
			response.end();
		} else {
			response.render('street_details.html', {params: params, segments: result && result.rows});
		}
		console.timeEnd("street/details");
	});
}

	// =============================================================================================
	//					store selected street in DB to ignore in future evaluations
	// ---------------------------------------------------------------------------------------------
function ignore(request, response) {
	console.time("street/ignore");

	var params = {
		countrycode:	request.query["country"] || "",
		municipality:	request.query["municipality"] || "",
		jobid:			request.query["job_id"] || "",
		streetid:		request.query["street_id"] || "",
		osmids:			request.query["osmid"] || []
	};
	
	if(typeof params.osmids == "string" && params.osmids) {
		params.osmids = [params.osmids];
	}

	for(var parami in params) {
		console.log("in street/ignore: params["+parami+"]===" + params[parami] + "===");
	}
	
	var insert_sql = "INSERT INTO jobs_strassen_blacklist"
		+ " (job_id, strasse_id, osm_ids)"		//TODO osm_ids should be either renamed or reused (now it holds only one osm_id)
		+ " SELECT $1, $2, unnest($3::text[]) RETURNING id;";
		
	response.simpleQuery({name: "street_ignore", text: insert_sql, values: [params.jobid, params.streetid, params.osmids]}, 
	function(error, result) {
		if(error) {
			console.log("error, but no further information " + error.toString());
			response.writeHead(400, {"Content-Type": "text/plain"});
			response.write(error.toString());
			response.end();
		} else {
			response.render('street_ignore.html', {params: params, result: result.rows});
		}
		console.timeEnd("street/ignore");
	});
}


//=============================================================================================
//					show list of ignored streets
//---------------------------------------------------------------------------------------------
function ignorelist(request, response) {
	console.time("street/ignorelist");

	var params = {
		countrycode:	request.query["country"] || "",
		municipality:	request.query["municipality"] || "",
		jobid:			request.query["job_id"] || "",
	};

	for(var parami in params) {
		console.log("in street/ignorelist: params["+parami+"]===" + params[parami] + "===");
	}

	var query_string = "SELECT jobname, jsb.id AS ignorierte_strasse_recordid, jobname, strasse, osm_ids" +
		"FROM jobs_strassen_blacklist AS jsb JOIN jobs AS j ON jsb.job_id = j.id " +
		"JOIN strasse AS str ON jsb.strasse_id = str.id " +
		"WHERE jsb.job_id = $1 " +
		"ORDER BY correctorder(strasse), osm_ids;";
	console.log("query to get ignored streets ===" + query_string + "===");

	response.simpleQuery({name: "street_ignorelist", text: query_string, values: [params.jobid]}, function(error, result) {
		if(error) {
			console.log("error, but no further information " + error.toString());
			response.writeHead(400, {"Content-Type": "text/plain"});
			response.write(error.toString());
			response.end();
		} else {
			response.render('street_ignorelist.html', {params: params, streets: result && result.rows});
		}
		console.timeEnd("street/ignorelist");
	});
}


// =============================================================================================
//					reactivate a street, stored to ignore in evaluations
// ---------------------------------------------------------------------------------------------
function reactivate(request, response) {
	console.time("street/reactivate");

	var params = {
		countrycode:	request.query["country"] || "",
		municipality:	request.query["municipality"] || "",
		jobid:			request.query["job_ids"] || "",
		ignoreids:		request.query["ignoreid"] || []
	};

	if(params.ignoreids != undefined && (typeof params.ignoreids == "string")) {
		params.ignoreids = [params.ignoreids];
	}
	for(var parami in params) {
		console.log("in street/reactivate: params["+parami+"]===" + params[parami] + "===");
	}

	var delete_sql = "DELETE FROM jobs_strassen_blacklist"
		+ " WHERE job_id = $1"
		+ " AND id IN (SELECT unnest($2::bigint[]));";
	console.log("delete_sql ===" + delete_sql + "===");
	
	response.simpleQuery({name: "street_reactivate", text: delete_sql, values: [params.jobid, params.ignoreids]}, 
	function(error, result) {
		if(error) {
			console.log("error, but no further information " + error.toString());
			response.writeHead(400, {"Content-Type": "text/plain"});
			response.write(error.toString());
			response.end();
			console.timeEnd("street/reactivate");
		} else {
			var query_string = "SELECT jobname, jsb.id AS ignorierte_strasse_recordid, jobname, strasse, osm_ids" +
				"FROM jobs_strassen_blacklist AS jsb JOIN jobs AS j ON jsb.job_id = j.id " +
				"JOIN strasse AS str ON jsb.strasse_id = str.id " +
				"WHERE jsb.job_id = $1 " +
				"ORDER BY correctorder(strasse), osm_ids;";
			console.log("query to get ignored streets ===" + query_string + "===");

			response.simpleQuery({name: "street_ignorelist", text: query_string, values: [params.jobid]}, 
			function(error, result) {
				if(error) {
					console.log("error, but no further information " + error.toString());
					response.writeHead(400, {"Content-Type": "text/plain"});
					response.write(error.toString());
					response.end();
				} else {
					response.render('street_ignorelist.html', {params: params, streets: result && result.rows});
				}
				console.timeEnd("street/reactivate");
			});
		}
	});
}


exports.details = details;
exports.ignore = ignore;
exports.ignorelist = ignorelist;
exports.reactivate = reactivate;
