Date.prototype.format = function (mask, utc) {
    return dateFormat(this, mask, utc);
};

L.TimeDimension.Layer.SODAHeatMap = L.TimeDimension.Layer.extend({

    initialize: function (options) {
        let heatmapCfg = this._getHeatmapOptions(options.heatmatOptions || {});
        let layer = new HeatmapOverlay(heatmapCfg);
        L.TimeDimension.Layer.prototype.initialize.call(this, layer, options);
        this._currentLoadedTime = 0;
        this._currentTimeData = {
            max: this.options.heatmapMax || 10,
            data: []
        };
        this._baseURL = this.options.baseURL || null;
        this._period = this.options.period || "PT1H";
    },

    _getHeatmapOptions: function (options) {
        let config = {};
        let defaultConfig = {
            radius: 10,
            maxOpacity: .8,
            scaleRadius: false,
            useLocalExtrema: false,
            latField: 'lat',
            lngField: 'lng',
            valueField: 'count'
        };
        for (let attrname in defaultConfig) {
            config[attrname] = defaultConfig[attrname];
        }
        for (let attrname in options) {
            config[attrname] = options[attrname];
        }
        return config;
    },

    onAdd: function (map) {
        L.TimeDimension.Layer.prototype.onAdd.call(this, map);
        map.addLayer(this._baseLayer);
        if (this._timeDimension) {
            this._getDataForTime(this._timeDimension.getCurrentTime());
        }
    },

    _onNewTimeLoading: function (ev) {
        this._getDataForTime(ev.time);
        return;
    },

    isReady: function (time) {
        return (this._currentLoadedTime === time);
    },

    _update: function () {
        this._baseLayer.setData(this._currentTimeData);
        return true;
    },

    _getDataForTime: function (time) {
        if (!this._baseURL || !this._map) {
            return;
        }
        delete this._currentTimeData.data;
        this._currentTimeData.data = [];

        console.log(this._timeDimension.getCurrentTime());
        this._callAPI(time);

    },

    myJsonMethod: function (){
        console.log('here')
    },

    _makeRequest: function (url, time) {

        let oReq = new XMLHttpRequest();
        oReq.addEventListener("load", (function (xhr) {

            try {
                let response = xhr.currentTarget.response;
                let data = JSON.parse(response);

                for (let i = 0; i < data['data'].length && i <= 1; i++) {
                    let marker = data['data'][i];

                    this._currentTimeData.data.push({
                        lat: marker.Latitude,
                        lng: marker.Longitude,
                        count: marker['pm10.0 (ug/m^3)'],
                        rad: 10,
                    });
                }
                this._currentLoadedTime = time;
                if (this._timeDimension && time === this._timeDimension.getCurrentTime() && !this._timeDimension.isLoading()) {
                    this._update();
                }

                this.fire('timeload', {
                    time: time
                });
            }
            catch (e) {
                console.log(e)
            }
        }).bind(this));

        oReq.open("GET", url);
        oReq.send();
    },

    _constructQuery: function (id, time) {
        let bbox = this._map.getBounds();
        let sodaQueryBox = [bbox._northEast.lat, bbox._southWest.lng, bbox._southWest.lat, bbox._northEast.lng];

        let startDate = new Date(time);
        let endDate = new Date(startDate.getTime());
        L.TimeDimension.Util.addTimeDuration(endDate, this._period, false);

        let params = "?id=" + id +
            "&sensorSource=PurpleAir&" +
            "start=" + startDate.format('yyyy-mm-dd') + "T" + startDate.format('HH:MM:ss') + "Z&" +
            "end=" + endDate.format('yyyy-mm-dd') + "T" + endDate.format('HH:MM:ss') + "Z&" +
            "show=all";
        let url = "https://cors-anywhere.herokuapp.com/" + this._baseURL + params;
        console.log(url);
        return url;
    },

    _callAPI: function (time) {
        let ids = [];
        let _this = this;

        jQuery.get('data/PurpleAirIDs.txt', undefined, function (data) {
            ids = data.split('\n');
        }, "html").done(function () {

            let i;
            for (i = 0; i < ids.length; i++) {
                let url = _this._constructQuery(ids[i], time);
                _this._makeRequest(url, time);
            }
        });
    }
});

L.timeDimension.layer.sodaHeatMap = function (options) {
    return new L.TimeDimension.Layer.SODAHeatMap(options);
};


let currentTime = new Date();
currentTime.setUTCDate(1, 0, 0, 0, 0);


let map = L.map('map', {
    zoom: 9,
    fullscreenControl: true,
    timeDimension: true,
    timeDimensionOptions: {
        timeInterval: "2018-04-01/2018-04-02",
        period: "PT1H",
        currentTime: Date.parse("2018-04-01T00:00:00Z")
    },
    center: [40.6924, -111.9046],
});

let layer = new L.StamenTileLayer("toner-lite");
map.addLayer(layer);

let testSODALayer = L.timeDimension.layer.sodaHeatMap({
    baseURL: 'https://air.eng.utah.edu/dbapi/api/rawDataFrom',
});
testSODALayer.addTo(map);

L.Control.TimeDimensionCustom = L.Control.TimeDimension.extend({
    _getDisplayDateFormat: function (date) {
        return date;//.format("mmmm yyyy");
    }
});

let timeDimensionControl = new L.Control.TimeDimensionCustom({
    playerOptions: {
        buffer: 1,
        minBufferReady: -1
    }
});
map.addControl(timeDimensionControl);

let ids = [];

jQuery.get('data/PurpleAirTest.csv', undefined, function (data) {
    ids = data.split('\n');

    for (let i = 1; i < ids.length; i++) {
        let sensor = ids[i].split(',');

        marker = L.circle([+sensor[1], +sensor[2]],
            {
                color: '#00FFFF00',
                // color: 'red',
                fillColor: '#00FFFF00',
                fillOpacity: 0.5,
                radius: 500
            })
            .bindPopup("<b>Sensor: " + sensor[0] + "</b><br>PM: " + sensor[3])
            .addTo(map);

        marker.on('mouseover', function (e) {
            this.openPopup();
        });

        marker.on('mouseout', function (e) {
            this.closePopup();
        });
    }
});
