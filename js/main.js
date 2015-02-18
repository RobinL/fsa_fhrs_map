//https://github.com/Leaflet/Leaflet.markercluster
//http://consumerinsight.which.co.uk/maps/hygiene
//


var FSA_APP = {}


//Add into TopoJSON support
L.TopoJSON = L.GeoJSON.extend({
    addData: function(jsonData) {
        if (jsonData.type === "Topology") {
            for (key in jsonData.objects) {
                geojson = topojson.feature(jsonData, jsonData.objects[key]);
                L.GeoJSON.prototype.addData.call(this, geojson);
            }
        } else {
            L.GeoJSON.prototype.addData.call(this, jsonData);
        }
    }
})


$(function() {

    createMap()

    $(".checkbox").change(function() {
        showHideLayers(this)
    })

    promise1 = $.get('topo_json/topo_lad.json', addGeoJson, 'json');
    promise2 = createAuthorityLookups()
    promise3 = addProsecutions()


    Promise.all([promise1, promise2]).then(showHideLayers)

    FSA_APP.map.locate({
        setView: true,
        maxZoom: 30
    }).on("locationfound", function(e) {

        highlightMapCentre()
    }).on("locationerror", function(e) {
        FSA_APP.map.setView([52.505, -0.09], 5);

    })


})



function showHideLayers(click_object) {

    layersArr = []

    layersArr.push({
        "selector": "#prosecutions",
        "layer": FSA_APP.layers.prosecutions
    })

    layersArr.push({
        "selector": "#local_authorities",
        "layer": FSA_APP.layers.local_authorities
    })

    layersArr.push({
        "selector": "#FHRS_score",
        "layer": FSA_APP.layers.FHRS_circles
    })


    for (var i = 0; i < layersArr.length; i++) {

        try {
            var d = layersArr[i]
            if ($(d["selector"]).is(':checked')) {
             
                FSA_APP.map.addLayer(d["layer"])
            } else {
                FSA_APP.map.removeLayer(d["layer"])
            }
        } catch (err) {console.log(err)}
    }


};


function createAuthorityLookups() {

    promise = d3.csv("data/lookups/authoritynamesandcodes.csv", function(data) {




        //Also create global variable that llows us to lookup between code and LAD13CD code

        geojsonToAuthorityCodeLookup = {}
        authorityCodeToGeoJsonLookup = {}
        for (var i = 0; i < data.length; i++) {
            authorityCodeToGeoJsonLookup[data[i]["localauthoritycode"]] = {
                "authorityCodeToGeoJsonLookup": data[i]["localauthorityname"],
                "LAD13CD": data[i]["LAD13CD"]
            }
            geojsonToAuthorityCodeLookup[data[i]["LAD13CD"]] = {
                "localauthorityname": data[i]["localauthorityname"],
                "authorityid": data[i]["localauthoritycode"]
            }

        };



    });

    return promise


}


function addFHRSCircles(geojsonid) {

    authorityid = geojsonToAuthorityCodeLookup[geojsonid]["authorityid"]

    d3.csv("data/fhrs/" + authorityid + ".csv", function(data) {

        addToMap(data)

    });


    function addToMap(data) {
        var markerArray = [];

        for (var i = 0; i < data.length; i++) {

            d = data[i]
            lat = d["latitude"]
            lng = d["longitude"]
            rating = d["ratingvalue"]
            businessname = d["businessname"]


            if (typeof lat === 'undefined') {
                continue
            };

            //Convert to numeric
            lat = lat + 0.0
            lng = lng + 0.0


            style = {

                "color": "#0625FF",
                "weight": 0,
                "opacity": 1,
                "fillColor": getFillColour(rating),
                "fillOpacity": 0.7,
                "radius": 5

            };

            function getFillColour(rating) {


                var color = d3.scale.linear()
                    .domain([0, 1, 2, 3, 4, 5])
                    .range(["#868686", "#E60000", "#FF7611", "#FDC400", "#B4E800", "#63FE05"]);

                color = color(rating)
                if (rating == "Exempt") {
                    color = "#868686"
                }
                return color
            }


            m = L.circleMarker([lat, lng], style)

            

            m.bindPopup("<div> Name: " + d.businessname + "</div>" + "<div> FHRS rating:" + d.ratingvalue + "</div>")

            markerArray.push(m);

        };



        FSA_APP.layers.FHRS_circles = L.featureGroup(markerArray).addTo(map);

    }


}

function addGeoJson(geoData) {


    FSA_APP.layers.local_authorities = new L.TopoJSON()
    my_l = FSA_APP.layers.local_authorities

    my_l.addData(geoData)

    my_l.eachLayer(handleLayer)


    var defaultStyle = {
        "weight": 2,
        "fillOpacity": 0.05
    }


    function handleLayer(layer) {

        layer.bindPopup(layer.feature.properties.LAD13NM);

        layer.on({
            click: highlight_and_add
        });


        function highlight_and_add(e) {

            my_l.eachLayer(function(layer2) {
                layer2.setStyle(defaultStyle)
            })

            //Increase opacity of the layer that has been clicked on
            layer.setStyle({
                "fillOpacity": 0.3
            })


            FSA_APP.map.fitBounds(layer.getBounds());

            //Now remove and recreate the layer that displays FHRS ratings
            if (FSA_APP.layers.FHRS_circles) {
                FSA_APP.map.removeLayer(FSA_APP.layers.FHRS_circles)
            }
            FSA_APP.layers.FHRS_circles = null



            addFHRSCircles(layer.feature.id)



        }


    }
    my_l.eachLayer(function(layer2) {
        layer2.setStyle(defaultStyle)
    })
    my_l.addTo(FSA_APP.map)

}


function createMap() {

    FSA_APP.map = L.map('map').setView([51.505, -0.09], 10);
    map = FSA_APP.map

    FSA_APP.layers = {}
    // add an OpenStreetMap tile layer
    L.tileLayer('http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        maxZoom: 18
    }).addTo(map);


}

function highlightMapCentre() {

    var h = $("#map").height() / 2

    var w = $("#map").width() / 2

    simulateClick(w, h)


}

function simulateClick(x, y) {
    var clickEvent = document.createEvent('MouseEvents');
    clickEvent.initMouseEvent(
        'click', true, true, window, 0,
        0, 0, x, y, false, false,
        false, false, 0, null
    );
    document.elementFromPoint(x, y).dispatchEvent(clickEvent);
}

function addProsecutions() {


    promise = d3.csv("data/prosecutions/prosecutions.csv", function(data) {

        addToMap(data)

     
    });


    function addToMap(data) {

        var markerArray = [];

        for (var i = 0; i < data.length; i++) {
            lat = data[i]["lat"]
            lng = data[i]["lng"]

 


            markerArray.push(L.marker([lat, lng]));

        };

        FSA_APP.layers.prosecutions = L.featureGroup(markerArray).addTo(map);
        map.removeLayer(FSA_APP.layers.prosecutions)
        //map.fitBounds(group.getBounds());

    }
}