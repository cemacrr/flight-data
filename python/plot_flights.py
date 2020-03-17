#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Create a scatter plot from flight information JSON file.
Marker size relates to altitude and marker color relates to velocity
"""

# datetime for title:
import datetime
# json for data reading:
import json
# matplotlib for plotting:
import matplotlib.pyplot as plt

# cartopy bits for plotting maps:
import cartopy.crs as ccrs
import cartopy.feature as cfeature
from cartopy.mpl.ticker import LongitudeFormatter, LatitudeFormatter

# try to make a nice map plot using the cartopy library.
# more cartopy information:
#   https://scitools.org.uk/cartopy/docs/latest/
# projections:
#   https://scitools.org.uk/cartopy/docs/latest/crs/projections.html#cartopy-projections
# example plots:
#   https://scitools.org.uk/cartopy/docs/latest/gallery/index.html

# read in flight data from json:
with open('flights.json', 'r') as json_file:
    json_data = json.load(json_file)

# all flights:
all_flights = json_data['flights']

# data time stamp:
time_stamp = json_data['timestamp']
# convert to datetime:
time_dt = datetime.datetime.fromtimestamp(time_stamp)

# all_lats, lons, altitudes and velocities:
lats = [i['latitude'] for i in all_flights]
lons = [i['longitude'] for i in all_flights]
vels = [i['velocity'] for i in all_flights]
alts = [i['geo_altitude'] or 0 for i in all_flights]

# convert altitudes 0 -> 5000, 5 -> 45, for marker sizing:
alts = [((i / 5000) * 40) + 5 for i in alts]

# pick a projection for the map plot:
map_prj = ccrs.PlateCarree()

# set the dpi, width and height for the plot:
plt_dpi = 300
plt_w = 1500
plt_h = 1000

# create a figure of required size:
map_fig = plt.figure(figsize=(plt_w / plt_dpi, plt_h / plt_dpi), dpi=plt_dpi)

# create the map axes:
map_ax = plt.axes(projection=map_prj)

# add land and ocean:
map_ax.add_feature(cfeature.LAND)
map_ax.add_feature(cfeature.OCEAN)

# set the extent to cover uk.
# the crs is used to transform data between projections:
map_ax.set_extent([-7, 5, 49, 59], crs=ccrs.PlateCarree())

# scatter plot.
# add 'zorder' to make sure scatter is above background layers (land / ocean).
# assign output to variable 'sp' for later adding colorbar.
# the transform= converts the data as required for the projection, s= specifies point size and
# c= specifies colours, the linewidths= and edgecolors= remove the marker edges:
sp = map_ax.scatter(lons, lats, s=alts, c=vels, zorder=5, transform=ccrs.PlateCarree(),
                    linewidths=0, edgecolors=None, cmap='jet')

# set the x tick and y ticks for the plot:
map_ax.set_xticks([-6, -1, 4], crs=ccrs.PlateCarree())
map_ax.set_yticks([52, 57], crs=ccrs.PlateCarree())
# create formatters for axes labels:
lon_formatter = LongitudeFormatter(number_format='.1f', degree_symbol='')
lat_formatter = LatitudeFormatter(number_format='.1f', degree_symbol='')
# apply the formatter:
map_ax.xaxis.set_major_formatter(lon_formatter)
map_ax.yaxis.set_major_formatter(lat_formatter)

# set the title based on time:
map_ax.set_title(time_dt.strftime('%Y-%m-%d %H:%M:%S'))

# add the coastlines. set 'zorder' so the coastlines appear over the scatter plot:
map_ax.add_feature(cfeature.COASTLINE, zorder=10)

# save the plot:
plt.savefig('flights.png', dpi=plt_dpi)
