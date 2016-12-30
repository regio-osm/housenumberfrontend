// Read project configuration file to get DB-connection pararmeters and other system specific information
// the configuration filename will be put at node.js start as first and only parameter

var fs = require('fs');


function ApplicationConfiguration () {  
	this.servername = "";
	this.frontend_serverport = "";
	this.db_structure = "osm2pgsql";
	this.db_application_url = "";
	this.db_application_username = "";
	this.db_application_password = "";
	this.db_application_connection = "";		// will below be constructed by other parameters
	this.db_application_listofstreets_url = "";
	this.db_application_listofstreets_username = "";
	this.db_application_listofstreets_password = "";
	this.db_application_listofstreets_connection = "";		// will below be constructed by other parameters
	this.db_osm2pgsql_url = "";
	this.db_osm2pgsql_username = "";
	this.db_osm2pgsql_password = "";
	this.osmosis_laststatefile = "";
	this.frontend_programdir = "";
	this.backend_programdir = "";
	this.publichtml_dir = "";					// will be constructed below by other parameter
	
		// get some configuration infos
	var configuration_filename = process.argv[2];

	var filecontent = fs.readFileSync(configuration_filename);
	if(filecontent == undefined) {
	    console.log("ERROR: Konfigurationsdatei nicht gefunden oder leer");
	    return;
	}

    //console.log("gefundener Filecontent von Konfiguration.txt ==="+filecontent+"===");

    var dateizeilen = filecontent.toString().split("\n");

    var dateizeile = "";
	for(var zeilenindex = 0; zeilenindex < dateizeilen.length; zeilenindex++) {
		dateizeile = dateizeilen[zeilenindex];
		//console.log("properties Zeile raw ==="+dateizeile+"===");
		if((dateizeile == "") || (dateizeile.indexOf("=") == -1))
			continue;
		if(dateizeile.indexOf("#") != -1)
			dateizeile = dateizeile.substring(0,dateizeile.indexOf("#"));
		if(dateizeile == "")
			continue;
		var keyvalue = dateizeile.split("=");
		var key = keyvalue[0].trim();
		var value = keyvalue[1].trim();
		if (this.hasOwnProperty(key)) {
			this[key] = value;
			console.log("set Key [" + key + "] to value ===" + value + "===");
		} else {
			console.log("unbekannter Key [" + key + "] in Konfigurationszeile, insgesamt ===" + dateizeile + "===");
		}
	}

		// indirect generated constants

		// generate DB connection string with username:password@dburl
	if(	(this.db_application_url != "") &&
		(this.db_application_username != "") &&
		(this.db_application_password != "")) {
		var temp_url_net = this.db_application_url;
		var searchstring = "postgresql://"
		if(temp_url_net.indexOf(searchstring) != -1)
			temp_url_net = temp_url_net.substring(temp_url_net.indexOf(searchstring) + searchstring.length);
		console.log("temp_url_net ==="+temp_url_net+"===");
		this.db_application_connection = "postgres://" + this.db_application_username + ":" + this.db_application_password + "@" + temp_url_net;
		console.log("generated this.db_application_connection  ==="+this.db_application_connection +"===");
	}		

	if(	(this.db_application_listofstreets_url != "") &&
			(this.db_application_listofstreets_username != "") &&
			(this.db_application_listofstreets_password != "")) {
			var temp_url_net = this.db_application_listofstreets_url;
			var searchstring = "postgresql://"
			if(temp_url_net.indexOf(searchstring) != -1)
				temp_url_net = temp_url_net.substring(temp_url_net.indexOf(searchstring) + searchstring.length);
			console.log("temp_url_net ==="+temp_url_net+"===");
			this.db_application_listofstreets_connection = "postgres://" + this.db_application_listofstreets_username + ":" + this.db_application_listofstreets_password + "@" + temp_url_net;
			console.log("generated this.db_application_listofstreets_connection  ==="+this.db_application_listofstreets_connection +"===");
	}		

	if(		(this.publichtml_dir == "") 
		&&	(this.frontend_programdir != undefined)
		&&	(this.frontend_programdir != "")) {
		this.publichtml_dir = this.frontend_programdir + "/" + "public_html";
	}

	console.log(" .servername              					==="+this.servername+"===");
	console.log(" .frontend_serverport     					==="+this.frontend_serverport+"===");
	console.log(" .db_application_url      					==="+this.db_application_url+"===");
	console.log(" .db_application_username 					==="+this.db_application_username+"===");
	console.log(" .db_application_password 					==="+this.db_application_password+"===");
	console.log(" .db_osm2pgsql_url        					==="+this.db_osm2pgsql_url+"===");
	console.log(" .db_osm2pgsql_username   					==="+this.db_osm2pgsql_username+"===");
	console.log(" .db_application_connection				==="+this.db_application_connection+"===");
	console.log(" .db_application_listofstreets_url      	==="+this.db_application_listofstreets_url+"===");
	console.log(" .db_application_listofstreets_username	==="+this.db_application_listofstreets_username+"===");
	console.log(" .db_application_listofstreets_connection	==="+this.db_application_listofstreets_connection+"===");
	console.log(" .osmosis_laststatefile  					==="+this.osmosis_laststatefile+"===");
	console.log(" .backend_programdir 						==="+this.backend_programdir+"===");
	console.log(" .frontend_programdir  					==="+this.frontend_programdir+"===");
	console.log(" .publichtml_dir        					==="+this.publichtml_dir+"===");
    
	return this;
}

module.exports = ApplicationConfiguration;
