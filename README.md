## Flight Data

This code came out of an event organised by [Open Data Manchester](https://www.opendatamanchester.org.uk/), for [Open Data Day 2020](https://github.com/OpenDataManchester/OpenDataDay2020).

Thanks to those folks for organising the event, and everyone who attended for the ideas.

This repository contains some JavaScript which queries the [OpenSky Network API](https://opensky-network.org/apidoc/) to retrieve data about flights within 100km of Manchester airport, and tries to calculate an estimate of the emissions of these flights.

The method for estimating the emissions is based on the method described by the ODI Leeds people [here](https://github.com/odileeds/flight-data/tree/master/examples). Their [aircraft.csv](https://github.com/odileeds/flight-data/blob/master/resources/aircraft.csv) file and [this](https://github.com/flightaware/dump1090/blob/master/tools/vrs.csv.xz) CSV file from the FlightAware repository were used to build the [JSON file](static_data/aircraft.json) containing mappings of icao24 ids to emissions data.

The emissions value displayed on the web page is based on the [calculation](https://github.com/odileeds/flight-data/tree/master/examples#calculating-co2-emissions) used by the ODI Leeds emissions tool, and is the difference between the value produced at the current step and the previous step (i.e. when the distance value changes).

It's possible that this method is completely incorrect, and if so, I apologise! Hopefully it gives a reasonably useful estimate.

The web page can be viewed here:

* [https://cemacrr.github.io/flight-data/](https://cemacrr.github.io/flight-data/)

The variables which set the central location and radius are at the top of the [JavaScript](js/site.js), and can easily be adjusted for other locations.

There is also some [Python](python/) code which can be used to retrieve data from the OpenSky Network API, and also to create a simple plot of the data.
