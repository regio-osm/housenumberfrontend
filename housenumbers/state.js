// original filename from private repo: /housenumbers/state.js; version as of 2017-06-25

var async = require("async");
var fs = require('fs');


	// =============================================================================================
	//                                show
	// ---------------------------------------------------------------------------------------------
function show(request, response) {
	console.time("show");

	var count_regularopenresultfile = 0;
	var eldest_regularopenresultfile_date = undefined;
	var active_regularhousenumberclient_date = undefined;
	var finished_regularhousenumberclient_date = undefined;
	var active_instanthousenumberclient_date = undefined;
	var finished_instanthousenumberclient_date = undefined;
	var count_instantopenresultfile = 0;
	var eldest_instantopenresultfile_date = undefined;
	var osmdb1_timestampdate = undefined;

	if(global.configuration.servername == "regio-osm.de") {
		var dir_regularhousenumberclient = "/home/osm/apps/housenumberclient";
		var dir_instanthousenumberclient = "/home/osm/apps/housenumberinstantclient";
		var file_db1filetimestamp = "/home/osm/db-support/diffs/last.state.txt";
	} else {
		var dir_regularhousenumberclient = "/home/openstreetmap/NASI/OSMshare/programme/git/housenumberclient";
		var dir_instanthousenumberclient = "/home/openstreetmap/NASI/OSMshare/programme/git/housenumberinstantclient";
		var file_db1filetimestamp = "/home/openstreetmap/NASI/OSMshare/db-support/diffs/last.state.txt";
	}

	// check regular housenumberclient active state
	try {
		var filestat = fs.statSync(dir_regularhousenumberclient + "/src/evaluation.active");
		var filetime = filestat.mtime;
		console.log("* " + filename + "   " + filetime);
		active_regularhousenumberclient_date = filetime;
		console.log("evaluation.active file date: " + active_regularhousenumberclient_date);
	} catch (e) {
	    // It isn't accessible
	}

	// check regular housenumberclient finished state
	try {
		var filestat = fs.statSync(dir_regularhousenumberclient + "/src/evaluation.finished");
		var filetime = filestat.mtime;
		console.log("* " + filename + "   " + filetime);
		finished_regularhousenumberclient_date = filetime;
		console.log("evaluation.finished file date: " + finished_regularhousenumberclient_date);
	} catch (e) {
	    // It isn't accessible
	}

		// check evaluation result directory
	try {
		var filenames = fs.readdirSync(dir_regularhousenumberclient + "/data/uploaddata");
		console.log("Number of all files in regular housenumberclient result dir: " + filenames.length);
		for(var fileindex in filenames) {
			var filename = filenames[fileindex];
			if((filename == "." ) || (filename == ".."))
				continue;
			console.log("- " + filename + "...");
			if(filename.lastIndexOf(".") == -1)
				continue;
			var filetype = filename.substring(filename.lastIndexOf(".") + 1);
			if(filetype == "result")
				count_regularopenresultfile++;
			var filestat = fs.statSync(dir_regularhousenumberclient + "/data/uploaddata/" + filename);
			var filetime = filestat.mtime;
			console.log("* " + filename + "   " + filetime);
			if(		(eldest_regularopenresultfile_date == undefined)
				||	(eldest_regularopenresultfile_date > filetime))
				eldest_regularopenresultfile_date = filetime;
		}
		console.log("eldest file date: " + eldest_regularopenresultfile_date);
	} catch (e) {
	    // It isn't accessible
		console.log("regular housenumberclient result dir doesn't exists");
		console.log(e.toString());
	}

	// check instant housenumberclient active state
	try {
		var filestat = fs.statSync(dir_instanthousenumberclient + "/src/evaluation.active");
		var filetime = filestat.mtime;
		console.log("* " + filename + "   " + filetime);
		active_instanthousenumberclient_date = filetime;
		console.log("evaluation.active file date: " + active_instanthousenumberclient_date);
	} catch (e) {
	    // It isn't accessible
	}

	// check instant housenumberclient finished state
	try {
		var filestat = fs.statSync(dir_instanthousenumberclient + "/src/evaluation.finished");
		var filetime = filestat.mtime;
		console.log("* " + filename + "   " + filetime);
		finished_instanthousenumberclient_date = filetime;
		console.log("evaluation.finished file date: " + finished_instanthousenumberclient_date);
	} catch (e) {
	    // It isn't accessible
	}
	
	try {
		var filenames = fs.readdirSync(dir_instanthousenumberclient + "/data/uploaddata");
		console.log("Number of all files in instant housenumberclient result dir: " + filenames.length);
		for(var fileindex in filenames) {
			var filename = filenames[fileindex];
			if((filename == "." ) || (filename == ".."))
				continue;
			console.log("- " + filename + "...");
			if(filename.lastIndexOf(".") == -1)
				continue;
			var filetype = filename.substring(filename.lastIndexOf(".") + 1);
			if(filetype == "result")
				count_instantopenresultfile++;
			var filestat = fs.statSync(dir_instanthousenumberclient + "/data/uploaddata/" + filename);
			var filetime = filestat.mtime;
			console.log("* " + filename + "   " + filetime);
			if(		(eldest_instantopenresultfile_date == undefined)
				||	(eldest_instantopenresultfile_date > filetime))
				eldest_instantopenresultfile_date = filetime;
		}
		console.log("eldest file date: " + eldest_instantopenresultfile_date);
	} catch (e) {
	    // It isn't accessible
		console.log("instant housenumberclient result dir doesn't exists");
		console.log(e.toString());
	}

	try {
		var filecontent = fs.readFileSync(file_db1filetimestamp, 'utf8');
		console.log("DB 1 file timestamp file length: " + filecontent.length);
		var filecontentlines = filecontent.toString().split("\n");
		console.log("Number file lines: " + filecontentlines.length);
		for(var zeilenindex in filecontentlines) {
			var fileline = filecontentlines[zeilenindex];
			console.log("+ Zeile [" + zeilenindex + "] ===" + fileline + "===");
			console.log("pos timestamp: " + fileline.indexOf("timestamp="));
			if(fileline.indexOf("timestamp=") == 0) {
				var local_time = fileline.substring(fileline.indexOf("=")+1);
					// remove special charater \: to :
				local_time = local_time.replace(/\\/gi,"");
					// change abbreviation Z to +00:00, otherwise parsing fails
				local_time = local_time.replace("Z","+0000");
				console.log("local_time ==="+local_time+"===");
				osmdb1_timestampdate = new Date(local_time);
				console.log("age of DB 1 in sec: " + (new Date().getTime() - osmdb1_timestampdate.getTime())/1000);
			}
		}
	} catch (e) {
	    // It isn't accessible
		console.log("DB 1 timestamp file doesn't exists");
		console.log(e.toString());
	}
	
	
	
	var outputtext = "";
	var data = {};

	

	var dataelement = {};
	dataelement.theme = "regular housenumberclient on server: active";
	dataelement.date = active_regularhousenumberclient_date;
	if(active_regularhousenumberclient_date != undefined) {
		dataelement.class = "service_ok";
		if((new Date().getTime() - active_regularhousenumberclient_date.getTime()) > (15*60*1000))		// 15 min
		dataelement.class = "service_failure";
	}
	data.housenumberclientregularactive = dataelement;
	
	var dataelement = {};
	dataelement.theme = "regular housenumberclient on server: last finished";
	dataelement.date = finished_regularhousenumberclient_date;
	if(finished_regularhousenumberclient_date != undefined) {
		dataelement.class = "service_ok";
		if((new Date().getTime() - finished_regularhousenumberclient_date.getTime()) > (15*60*1000))		// 15 min
		dataelement.class = "service_failure";
	}
	data.housenumberclientregularfinished = dataelement;

	var dataelement = {};
	dataelement.theme = "regular evaluations still to import";
	dataelement.count = count_regularopenresultfile;
	if(		(count_regularopenresultfile >= 0)
		&&	(count_regularopenresultfile < 100))
		dataelement.class = "service_ok";
	if(count_regularopenresultfile > 100)
		dataelement.class = "service_warning";
	dataelement.date = eldest_regularopenresultfile_date;
	if(		(eldest_regularopenresultfile_date != undefined)
		&&	((new Date().getTime() - eldest_regularopenresultfile_date.getTime()) > (12*60*60*1000)))		// 12 hours
		dataelement.class = "service_failure";
	data.regularopenresultfiles = dataelement;

	var dataelement = {};
	dataelement.theme = "instant housenumberclient on server: active";
	dataelement.date = active_instanthousenumberclient_date;
	if(active_instanthousenumberclient_date != undefined) {
		dataelement.class = "service_ok";
		if((new Date().getTime() - active_instanthousenumberclient_date.getTime()) > (15*60*1000))		// 15 min
		dataelement.class = "service_failure";
	}
	data.housenumberclientinstantactive = dataelement;
	
	var dataelement = {};
	dataelement.theme = "instant housenumberclient on server: last finished";
	dataelement.date = finished_instanthousenumberclient_date;
	if(finished_instanthousenumberclient_date != undefined) {
		dataelement.class = "service_ok";
		if((new Date().getTime() - finished_instanthousenumberclient_date.getTime()) > (15*60*1000))		// 15 min
		dataelement.class = "service_failure";
	}
	data.housenumberclientinstantfinished = dataelement;

	var dataelement = {};
	dataelement.theme = "instant evaluations still to import";
	dataelement.count = count_instantopenresultfile;
	dataelement.date = eldest_instantopenresultfile_date;
	if(		(count_instantopenresultfile >= 0)
		&&	(count_instantopenresultfile < 100))
		dataelement.class = "service_ok";
	if(count_instantopenresultfile > 100)
		dataelement.class = "service_warning";
	if(		(eldest_instantopenresultfile_date != undefined)
		&&	(new Date().getTime() - eldest_instantopenresultfile_date.getTime()) > (12*60*60*1000))		// 12 hours
		dataelement.class = "service_failure";
	data.instantopenresultfiles = dataelement;
	
	var dataelement = {};
	dataelement.theme = "age of primary local OSM DB";
	dataelement.date = osmdb1_timestampdate;
	if(		(osmdb1_timestampdate != undefined)
			&&	(new Date().getTime() - osmdb1_timestampdate.getTime()) < (3*60*60*1000))
			dataelement.class = "service_ok";
	if(		(osmdb1_timestampdate != undefined)
		&&	(new Date().getTime() - osmdb1_timestampdate.getTime()) > (3*60*60*1000))
		dataelement.class = "service_warning";
	if(		(osmdb1_timestampdate != undefined)
			&&	(new Date().getTime() - osmdb1_timestampdate.getTime()) > (12*60*60*1000))
			dataelement.class = "service_failure";
	data.osmdb1 = dataelement;


	response.render('state.html', {data: data});

	//-----------------------------------------------------
	return;
	//=====================================================

	var query_string = "SELECT osm_id as osm_relation_id, " +
		"ST_X(ST_Transform(ST_Centroid(gebiete.polygon),4326)) AS lon, " +
		"ST_Y(ST_Transform(ST_Centroid(gebiete.polygon),4326)) AS lat, " +
		"jobs.id AS job_id, " +
		"jobs.jobname AS jobname, " +
		"land.land, " +
		"stadt.stadt, " +
		"stadt.officialgeocoordinates, " +
		"stadt.sourcelist_url AS sourcelist_url, " +
		"stadt.sourcelist_copyrighttext AS sourcelist_copyrighttext, " +
		"stadt.sourcelist_useagetext AS sourcelist_useagetext, " +
		"to_char(stadt.sourcelist_contentdate, 'DD.MM.YYYY') AS sourcelist_contentdate, " +
		"to_char(stadt.sourcelist_filedate, 'DD.MM.YYYY') AS sourcelist_filedate, " +
		"evaluation.tstamp, " +
		"evaluation.osmdb_tstamp " +
		"FROM jobs " + 
		"JOIN gebiete ON jobs.gebiete_id = gebiete.id " +
		"JOIN land ON jobs.land_id = land.id " +
		"JOIN stadt ON jobs.stadt_id = stadt.id " +
		"LEFT JOIN " +
		"  (SELECT DISTINCT ON (job_id) * FROM evaluations " +
		"   WHERE number_target > 0 " +
		"   ORDER BY job_id, id DESC) evaluation " +
		"ON jobs.id = evaluation.job_id " +
		"WHERE land.land = $1 AND stadt.stadt = $2 AND jobs.id = ANY($3::int[]) " +
		"ORDER BY correctorder(jobs.jobname)";

	console.log("query for evaluation ===" + query_string + "===");
	console.log("parameter 1 ===" + params.land + "===");
	console.log("parameter 2 ===" + params.stadt + "===");
	console.log("parameter 3 ===" + params.jobidliste + "===");
	response.simpleQuery({name: "auswertung_execute_1", text: query_string, values: [params.land, params.stadt, params.jobidliste]}, function(j_error, j_result) {
	
		async.each(j_result.rows, function(j_row, callback) {

			var job = {
				job_id: j_row.job_id,
				gebiet_osm_id: -1 * parseInt(j_row.osm_relation_id),
				jobname: j_row.jobname,
				land: j_row.land,
				stadt: j_row.stadt,
				officialgeocoordinates: j_row.officialgeocoordinates,
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
	
			response.render(params.nursummen ? "auswertung_execute_summen.html" : "auswertung_execute.html", {params: params, auswertungsdaten: auswertungsdaten});

			console.timeEnd("show");
		});
	});
}


exports.show = show;
