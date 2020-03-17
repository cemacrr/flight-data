/** global variables: **/
var map;
var flight_data;
var flight_markers = [];
var aircraft_data;
/* api url: */
var flight_url = 'https://opensky-network.org/api/states/all';
/* aoi and radius in km for which data will be processed: */
var aoi_coord = {
  /* manchester airport: */
  'latitude': 53.3588,
  'longitude': -2.2727
};
var aoi_radius = 100;
/* refresh interval in seconds: */
var refresh_interval = 20;
/* stale time for removal of old markers in seconds: */
var stale_time_interval = 3 * refresh_interval;
/* stats: */
var flight_stats = {
  'html_observed_time': document.getElementById('stats_observed_time'),
  'html_on_ground': document.getElementById('stats_on_ground'),
  'html_in_air': document.getElementById('stats_in_air'),
  'html_total_distance': document.getElementById('stats_total_distance'),
  'html_total_emissions': document.getElementById('stats_total_emissions'),
  'observed_time': null,
  'on_ground': null,
  'in_air': null,
  'total_distance': null,
  'total_emissions': null
};

/* function to increae / decrease circle sizes: */
function update_markers(size_inc) {
  for (var i = 0; i < flight_markers.length; i++) {
    var old_size = flight_markers[i].getRadius();
    if (old_size == 3) {
      var new_size = 3;
    } else {
      var new_size = flight_markers[i].getRadius() + size_inc;
    };
    if (new_size < 3) {
      new_size = 3;
    };
    flight_markers[i].setRadius(new_size);
  };
};

/* load map function: */
function load_map() {

  /* define tile layers ... osm: */
  var osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: 'Basemap &copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
  });

  /* define map */
  map = L.map('content_map_map', {
    /* default layers: */
    layers: [
      osm
    ],
    /* map center: */
    center: [
      aoi_coord['latitude'],
      aoi_coord['longitude']
    ],
    /* define bounds: */
    maxBounds: [
      [aoi_coord['latitude'] - 0.7, aoi_coord['longitude'] - 2],
      [aoi_coord['latitude'] + 0.7, aoi_coord['longitude'] + 2]
    ],
    maxBoundsViscosity: 1.0,
    /*  zoom levels: */
    zoom:    8,
    minZoom: 7,
    maxZoom: 15
  });

  /* add scale bar: */
  L.control.scale().addTo(map);

  /* check zooming start: */
  var zoom_start;
  map.on('zoomstart', function() {
    zoom_start = map.getZoom();
  });

  /* make markers bigger / smaller on zoom: */
  map.on('zoomend', function() {
    /* get zoom level: */
    var zoom_end = map.getZoom();
    /* inital circle size based on zoom level: */
    if (zoom_start >= 13) {
      if (13 > zoom_end >= 10) {
        update_markers(-5);
      } else if (10 > zoom_end) {
        update_markers(-10);
     };
    } else if (13 > zoom_start >= 10) {
      if (zoom_end >= 13) {
        update_markers(+5);
      } else if (10 > zoom_end) {
        update_markers(-5);
      };
    } else if (10 > zoom_end) {
      if (13 > zoom_end >= 10) {
        update_markers(+5);
      } else if (zoom_end >= 13) {
        update_markers(+10);
      };
    };
    /* update stats: */
    update_stats();
  });

  /* update stats on map move: */
  map.on('moveend', function() {
    /* update stats: */
    update_stats();
  });

};

/* random html color generator: */
function get_color(flight_icao24) {
  /* init color: */
  var html_color = '#';
  /* check if a color has been assigned to this icao24 id: */
  for (var i = 0; i < flight_markers.length; i++) {
    if (flight_markers[i]['icao24'] == flight_icao24) {
      html_color = flight_markers[i].color;
    };
  };
  /* if a color has been found, return that: */
  if (html_color != '#') {
    return html_color;
  };
  /* allowable characters: */
  var chars = '0123456789abcdef';
  /* loop over length of color, and pick random character: */
  for (var i = 0; i < 6; i++) {
    html_color += chars[Math.floor(Math.random() * 16)];
  };
  /* return the color: */
  return html_color;
};

/*
   haversine distance calculation.
   this implementation borrowed entirely from here:
     https://stackoverflow.com/questions/14560999/using-the-haversine-formula-in-javascript#38549345
 */
function get_distance(coords1, coords2) {
  function toRad(x) {
    return x * Math.PI / 180;
  };
  var dLat = toRad(coords2.latitude - coords1.latitude);
  var dLon = toRad(coords2.longitude - coords1.longitude)
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(coords1.latitude)) *
          Math.cos(toRad(coords2.latitude)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 12742 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* update flight data: */
function update_data() {

  /* get data time stamp: */
  var current_time = new Date;
  var time_stamp = Math.round(current_time.getTime() / 1000);

  /* define stale time for marker removal: */
  var stale_time = time_stamp - stale_time_interval;
  /* flight markers which will be kept: */
  var new_markers = [];
  /* loop through markers ... : */
  for (var i = 0; i < flight_markers.length; i++) {
    if (flight_markers[i].timestamp < stale_time) {
      /* remove stale markers: */
      flight_markers[i].remove();
    } else if (flight_markers[i].timestamp < time_stamp) {
      /* reduce size of old markers: */
      var new_size = flight_markers[i].getRadius() - 3;
      if (new_size < 5) {
        new_size = 5;
      };
      flight_markers[i].setRadius(new_size);
      /* add to list of markers to keep: */
      new_markers.push(flight_markers[i]);
    };
  };

  /* loop though states: */
  var flight_states = flight_data['states'];
  for (var i = 0; i < flight_states.length; i++) {

    /* state information: */
    var flight_state = flight_states[i];
    /* get lat and lon for distance checking: */
    var flight_lat = flight_state[6];
    var flight_lon = flight_state[5];
    /* if no lat or lon returned, continue: */
    if ((flight_lat == undefined) ||
        (flight_lon == undefined)) {
      continue;
    };
    /* get distance from aoi: */
    var flight_coord = {
      'latitude': flight_lat,
      'longitude': flight_lon
    };
    var flight_distance = get_distance(aoi_coord, flight_coord);
    /* if not within interesting distance, continue: */
    if (flight_distance > aoi_radius) {
      continue;
    };
    /* get additional data: */
    var flight_icao24 = flight_state[0];
    var flight_callsign = flight_state[1].trim();
    var flight_timestamp = flight_state[4];
    var flight_onground = flight_state[8];
    var flight_velocity = flight_state[9];
    var flight_geoalt = flight_state[13];
    /* values which may be null ... velocity: */
    if (flight_velocity == null) {
      var flight_velocity_ms = '--';
    } else {
      var flight_velocity_ms = flight_velocity + ' m/s';
    };
    /* altitude: */
    if (flight_geoalt == null) {
      var flight_geoalt_m = '--';
    } else {
      var flight_geoalt_m = flight_geoalt + ' m';
    };
    /* lat: */
    if (flight_lat == null) {
      var flight_lat = '--';
    };
    /* lon: */
    if (flight_lon == null) {
      var flight_lon = '--';
    };
    /* convert time stamp to date: */
    var flight_date = new Date(flight_timestamp * 1000);
    var flight_hour = flight_date.getHours() < 10 ? '0' +
                      flight_date.getHours() :
                      flight_date.getHours();
    var flight_min = flight_date.getMinutes() < 10 ? '0' +
                      flight_date.getMinutes() :
                      flight_date.getMinutes();
    var flight_sec = flight_date.getSeconds() < 10 ? '0' +
                      flight_date.getSeconds() :
                      flight_date.getSeconds();
    var flight_time = flight_hour + ':' + flight_min + ':' + flight_sec;

    /* check for existing data for this flight: */
    var prev_timestamp = 0;
    var prev_lat = null;
    var prev_lon = null;
    var prev_observed_distance = null;
    var prev_observed_time = 0;
    var flight_fuel_tot = null;
    var flight_fuel_tot_marg_rate = null;
    var flight_corr_factor = null;
    var flight_co2_coeff = null;
    var flight_base_emissions = null;
    if (flight_markers.length > 0) {
      for (var j = 0; j < flight_markers.length; j++) {
        if ((flight_markers[j].icao24 == flight_icao24) &&
            (flight_markers[j].timestamp > prev_timestamp)) {
          prev_lat = flight_markers[j].lat;
          prev_lon = flight_markers[j].lon;
          prev_observed_distance = flight_markers[j].observed_distance;
          prev_observed_time = flight_markers[j].observed_time;
          prev_timestamp = flight_markers[j].timestamp;
          flight_fuel_tot = flight_markers[j].fuel_tot;
          flight_fuel_tot_marg_rate = flight_markers[j].fuel_tot_marg_rate;
          flight_corr_factor = flight_markers[j].corr_factor;
          flight_co2_coeff = flight_markers[j].co2_coeff;
          flight_base_emissions = flight_markers[j].base_emissions;
        };
      };
    };
    /* update observed time: */
    if (prev_timestamp == 0) {
      var flight_observed_time = 0;
    } else {
      var step_time = flight_timestamp - prev_timestamp;
      var flight_observed_time = prev_observed_time + step_time;
    };

    /* if any results: */
    if ((prev_lat != null) && (prev_lon != null) &&
        (prev_observed_distance != null)){
      var prev_coord = {
        'latitude': prev_lat,
        'longitude': prev_lon
      };
      var step_distance = get_distance(prev_coord, flight_coord);
      var flight_observed_distance = prev_observed_distance + step_distance;
      /* if we have the variables: */
      if ((flight_fuel_tot != null) && (flight_fuel_tot_marg_rate != null) &&
           (flight_corr_factor != null) && (flight_co2_coeff != null) &&
           (flight_observed_distance > 0) && (flight_base_emissions != null) &&
           (! isNaN(flight_base_emissions))) {
        /* calculate observed emissions: */
        var flight_observed_emissions = ((flight_fuel_tot + (flight_observed_distance / 1.852) *
                                          flight_fuel_tot_marg_rate) * flight_corr_factor *
                                          flight_co2_coeff) / 1000;
        /* deduct base emissions: */
        flight_observed_emissions = flight_observed_emissions - flight_base_emissions;
      };
    } else {
      var flight_observed_distance = 0;
      var flight_observed_emissions = null;
      /* get aircraft data: */
      var flight_type_data = aircraft_data[flight_icao24];
      /* if any results: */
      if (flight_type_data != undefined) {
        /* data for emissions calculating: */
        flight_fuel_tot = parseFloat(flight_type_data['FUEL_TOT']);
        flight_fuel_tot_marg_rate = parseFloat(flight_type_data['FUEL_TOT_MARG_RATE']);
        flight_corr_factor = parseFloat(flight_type_data['CORR_FACTOR']);
        flight_co2_coeff = parseFloat(flight_type_data['CO2_COEFF']);
      };
      /* if we have the variables: */
      if ((flight_fuel_tot != null) && (flight_fuel_tot_marg_rate != null) &&
           (flight_corr_factor != null) && (flight_co2_coeff != null)) {
        /* calculate base emissions: */
        flight_base_emissions = ((flight_fuel_tot + (flight_observed_distance / 1.852) *
                                  flight_fuel_tot_marg_rate) * flight_corr_factor *
                                  flight_co2_coeff) / 1000;
      };
    };
    /* string for observed emissions: */
    if (flight_observed_emissions == null) {
      var flight_observed_emissions_str = '--';
    } else {
      var flight_observed_emissions_str = flight_observed_emissions.toFixed(2) + ' kg';
    };

    /* properties for circle marker ... get a color for this circle: */
    var circle_color = get_color(flight_icao24);
    if (flight_onground) {
      /* on ground color: */
      var display_color = "#909090";
    } else {
      var display_color = circle_color;
    };
    /* try to set circle size based on altitude: */
    var zoom_level = map.getZoom();
    /* base circle size is based on zoom level: */
    if (zoom_level >= 13) {
      var circle_size = 15;
    } else if (13 > zoom_level >= 10) {
      var circle_size = 10;
    } else {
      var circle_size = 5;
    };
    /* increase size based on altitude: */
    if (flight_geoalt != null) {
      var circle_inc = Math.round(flight_geoalt / 500) * 1;
      if (circle_inc > 10) {
        circle_inc = 10;
      };
      circle_size += circle_inc;
    };

    /* add marker to map: */
    var circle_marker = L.circleMarker(
      [flight_lat, flight_lon],
      {color: display_color,
       radius: circle_size,
       weight: 0,
       fillOpacity: 0.6}
    ).bindTooltip(
      '<span class="circle_label">Call sign :</span> ' + flight_callsign + '<br>' +
      '<span class="circle_label">Time :</span> ' + flight_time + '<br>' +
      '<span class="circle_label">Geometric altitude :</span> ' + flight_geoalt_m + '<br>' +
      '<span class="circle_label">Velocity :</span> ' + flight_velocity_ms + '<br>' +
      '<span class="circle_label">Observed distance :</span> ' + flight_observed_distance.toFixed(2) + ' km' + '<br>' +
      '<span class="circle_label">Observed CO₂ emissions :</span> ' + flight_observed_emissions_str
    );
    circle_marker.icao24 = flight_icao24;
    circle_marker.callsign = flight_callsign;
    circle_marker.timestamp = time_stamp;
    circle_marker.lat = flight_lat;
    circle_marker.lon = flight_lon;
    circle_marker.color = circle_color;
    circle_marker.onground = flight_onground;
    circle_marker.geoalt = flight_geoalt;
    circle_marker.observed_distance = flight_observed_distance;
    circle_marker.observed_time = flight_observed_time;
    circle_marker.fuel_tot = flight_fuel_tot;
    circle_marker.fuel_tot_marg_rate = flight_fuel_tot_marg_rate;
    circle_marker.corr_factor = flight_corr_factor;
    circle_marker.co2_coeff = flight_co2_coeff;
    circle_marker.base_emissions = flight_base_emissions;
    circle_marker.observed_emissions = flight_observed_emissions;
    circle_marker.addTo(map);
    new_markers.push(circle_marker);

   /* end loop through flight states: */
  };

  /* update flight_markers: */
  flight_markers = new_markers;

};

/* update statistics: */
function update_stats() {

  /* init vars for stats: */
  var stats_on_ground = 0;
  var stats_in_air = 0;
  var stats_total_distance = 0;
  var stats_total_emissions = 0;

  /* var for icao24 ids which have been dealt with: */
  var processed_ids = [];

  /* maximum observed time: */
  var max_observed_time = null;

  /* if any markers: */
  if (flight_markers.length > 0) {
    /* loop through flight markers: */
    for (var i = 0; i < flight_markers.length; i++) {
      /* marker for this flight: */
      var flight_marker = flight_markers[i];
      /* if this marker is not in view ... : */
      if (! map.getBounds().contains(flight_marker.getLatLng())) {
        continue;
      };
      /* update max observed time: */
      if (max_observed_time == null) {
        max_observed_time = flight_markers[i].observed_time;
      } else {
        max_observed_time = Math.max(max_observed_time,
                                     flight_markers[i].observed_time);
      }
      /* get icao24: */
      var flight_icao24 = flight_marker.icao24;
      /* if this id has been processed ... : */
      if (processed_ids.includes(flight_icao24)) {
        continue;
      };
      /* loop though markers again, to see if this is the most recent marker
         for this flight: */
      for (var j = 0; j < flight_markers.length; j++) {
        if ((flight_markers[j].icao24 == flight_icao24) &&
            (flight_markers[j].timestamp > flight_marker.timestamp) &&
            (map.getBounds().contains(flight_markers[j].getLatLng()))) {
          /* update max observed time: */
          max_observed_time = Math.max(max_observed_time,
                                       flight_markers[j].observed_time);
          /* flight_marker is now this marker: */
          flight_marker = flight_markers[j];
        };
      };

      /* update on ground / in air: */
      if (flight_marker.onground) {
        stats_on_ground += 1;
      } else {
        stats_in_air += 1;
      };
      /* total distance: */
      if ((flight_marker.observed_distance != undefined) &&
          (flight_marker.observed_distance != null)) {
        stats_total_distance += flight_marker.observed_distance;
      };
      /* total emissions: */
      if ((flight_marker.observed_emissions != undefined) &&
          (flight_marker.observed_emissions != null)) {
        stats_total_emissions += flight_marker.observed_emissions;
      };

      /* mark this id as processed: */
      processed_ids.push(flight_icao24);

    /* end loop though markers: */
    };
  /* end check for markers: */
  };

  /* check max observed time: */
  if (max_observed_time != null) {
    /* update observed time: */
    var observed_time = max_observed_time;
  } else {
    var observed_time = 0;
  };
  var observed_minutes = Math.floor(observed_time / 60);
  var observed_seconds = observed_time - (observed_minutes * 60);

  /* update stats in html: */
  flight_stats['html_observed_time'].innerHTML = ' ' + observed_minutes + ' minutes ' +
                                                 observed_seconds + ' seconds';
  flight_stats['html_on_ground'].innerHTML = ' ' + stats_on_ground;
  flight_stats['html_in_air'].innerHTML = ' ' + stats_in_air;
  flight_stats['html_total_distance'].innerHTML = ' ' + stats_total_distance.toFixed(2) + ' km';
  flight_stats['html_total_emissions'].innerHTML = ' ' + stats_total_emissions.toFixed(2) + ' kg';

};

/* load static data: */
function load_static_data() {
  /* create new request: */
  var flight_req = new XMLHttpRequest();
  flight_req.responseType = 'json';
  flight_req.open('GET', './static_data/aircraft.json', true);
  /* set timeout: */
  flight_req.timeout = (refresh_interval - 1) * 1000;
  /* on data download: */
  flight_req.onload = function() {
    /* set aircraft_data variable: */
    aircraft_data = flight_req.response;
    /* load flight data: */
    load_data();
  };
  /* send the request: */
  flight_req.send(null);
};

/* load data: */
function load_data() {
  /* create new request: */
  var flight_req = new XMLHttpRequest();
  flight_req.responseType = 'json';
  flight_req.open('GET', flight_url, true);
  /* set timeout: */
  flight_req.timeout = (refresh_interval - 1) * 1000;
  /* on data download: */
  flight_req.onload = function() {
    /* set flight_data variable: */
    flight_data = flight_req.response;
    /* update flight data: */
    update_data();
    /* update stats: */
    update_stats();
  };
  /* send the request: */
  flight_req.send(null);
};

/* load content function: */
function load_content() {
  /* load the map: */
  load_map();
  /* load the data: */
  load_static_data();
  /* refresh data at requested interval: */
  setInterval(load_data, refresh_interval * 1000);
};

/** add listeners: **/

/* on page load: */
window.addEventListener('load', function() {
  /* load the content: */
  load_content();
});
