#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Get current flight information for flights around Manchester airport
using OpenSky API

write output as JSON and CSV
"""

# standard Library imports:
import csv
import datetime
import json
import math
import sys
# urllib python2 / python3 differences:
try:
    from urllib.request import Request, urlopen
    from urllib.parse import urlencode
except ImportError:
    from urllib import urlencode
    from urllib2 import Request, urlopen

# ---

# global variables ...
# lat and lon for point of interest:
AOI_LAT = 53.3588
AOI_LON = -2.2727

# radius for aoi in km:
AOI_RADIUS = 100

# url of opensky rest api:
API_URL = 'https://opensky-network.org/api'

# format for date strings:
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# output file names:
JSON_OUT = 'flights.json'
CSV_OUT = 'flights.csv'

# ---

def get_url(req_url, req_user=None):
    """
    Get url with urllib
    """
    # init response as False:
    req_response = False
    # try to retrieve the URL:
    try:
        url_request = Request(req_url)
        # if user details specified:
        if req_user:
            # add basic auth header:
            url_request.add_header('Authorization',
                                   'Basic {0}'.format(req_user))
        # get response:
        req_response = urlopen(url_request)
    except Exception as ex_cep:
        sys.stderr.write('Error retrieveing URL : {0}\n'.format(ex_cep))
        sys.exit(1)
    # return the response:
    return req_response

def get_distance(start_lat, start_lon, end_lat, end_lon,
                 use_km=True, use_round=False, earth_radius=6371e3):
    """
    Returns the distance between two points in m / km

    This uses the haversine method as described here:

      https://www.movable-type.co.uk/scripts/latlong.html
    """
    # convert lats and lons to radians:
    lat_a = math.radians(start_lat)
    lat_b = math.radians(end_lat)
    lon_a = math.radians(start_lon)
    lon_b = math.radians(end_lon)
    # differences in lat and lon values:
    d_lat = (lat_b - lat_a)
    d_lon = (lon_b - lon_a)
    # "square of half the chord length between the points":
    var_a = (math.pow(math.sin(d_lat / 2), 2) + math.cos(lat_a) * math.cos(lat_b)
             * math.pow(math.sin(d_lon / 2), 2))
    # "angular distance in radians":
    var_c = 2 * math.atan2(math.sqrt(var_a), math.sqrt(1 - var_a))
    # distance in metres:
    dist = earth_radius * var_c
    # convert to km?:
    if use_km:
        dist = dist / 1000
    # round?:
    if use_round:
        dist = round(dist)
    # return the distance:
    return dist

def main():
    # get all flight data .. request url:
    all_url = '/'.join([API_URL, 'states', 'all'])
    all_response = get_url(all_url)
    all_json = json.loads(all_response.read())

    # timestamp and all states:
    data_timestamp = all_json['time']
    data_states = all_json['states']

    # convert timestampt to date string:
    data_datetime = datetime.datetime.fromtimestamp(data_timestamp)
    data_time = datetime.datetime.strftime(data_datetime, DATE_FORMAT)

    # create a list for flights of interest:
    flight_list = []

    # loop through flight data:
    for data_state in data_states:
        # get lat and lon first for distance checking:
        flight_lat = data_state[6]
        flight_lon = data_state[5]

        # if lat and lon values returned, check distance:
        if flight_lat and flight_lon:
            flight_distance = get_distance(AOI_LAT, AOI_LON,
                                           flight_lat, flight_lon)
        else:
            continue

        # ignore anything outside radius:
        if flight_distance > AOI_RADIUS:
            continue

        # convert last cont time to string:
        last_contact = data_state[4]
        last_contact_datetime = datetime.datetime.fromtimestamp(last_contact)
        last_contact_time = datetime.datetime.strftime(last_contact_datetime,
                                                       DATE_FORMAT)

        # store details in dict:
        flight_dict = {
            'timestamp': data_timestamp,
            'time': data_time,
            'distance': flight_distance,
            'icao24': data_state[0],
            'callsign': data_state[1].strip(),
            'origin_country': data_state[2],
            'last_contact': last_contact,
            'last_contact_time': last_contact_time,
            'longitude': flight_lon,
            'latitude': flight_lat,
            'baro_altitude': data_state[7],
            'on_ground': data_state[8],
            'velocity': data_state[9],
            'true_track': data_state[10],
            'veritcal_rate': data_state[11],
            'sensors': data_state[12],
            'geo_altitude': data_state[13],
            'squawk': data_state[14],
            'spi': data_state[15],
            'position_source': data_state[16]
        }

        # add to list of flights:
        flight_list.append(flight_dict)

        # no results, exit:
        if not flight_list:
            sys.exit()

        # dict for data:
        data_dict = {'timestamp': data_timestamp,
                     'time': data_time,
                     'flights': flight_list}

        # save as json:
        with open(JSON_OUT, 'w') as json_file:
            json.dump(data_dict, json_file)

        # save as csv:
        with open(CSV_OUT, 'w') as csv_file:
            csv_writer = csv.DictWriter(csv_file, flight_list[0].keys())
            csv_writer.writeheader()
            csv_writer.writerows(flight_list)


if __name__ == '__main__':
    main()
