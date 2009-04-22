(function($) {
	$.fn.extend({
		gradius: function(options) {

			options = $.extend({
				namespace: 'gradius',
				min: 0,
				max: 50,
				step: 5,
				defaultRadius: 25,
				color: "#0D99E5",
				defaultLocation: { name: "Harrisburg", lat: 40.273963, lng: -76.884855 }
			}, options);

			// Create a single geocoder for all maps to utilize caching.
			var geocoder = new GClientGeocoder(),
				defaultLatLng = new GLatLng(options.defaultLocation.lat, options.defaultLocation.lng);

			this.each(function() {

				var $this = $(this),
					locationInput = $this.find("input[name=location]"),
					radiusDisplay = $this.find(".radiusDisplay"),
					locationDisplay = $this.find(".locationDisplay"),

					latLngInput = $this.find("input[name=latLng]"),
					locationNameInput = $this.find("input[name=locationName]"),
					radiusInput = $this.find("input[name=radius]"),
					saveForm = latLngInput.closest("form"),

					map = new GMap2($this.find(".map").get(0));

				map.setCenter(defaultLatLng);
				map.disableDragging();

				if (!locationInput.val()) {
					locationInput.val(options.defaultLocation.name);
					setLocationName(options.defaultLocation.name);
				}

				if (!radiusInput.val()) {
					radiusInput.val(options.defaultRadius);
				}

				// Build the slider after the radius value has been set.
				var slider = buildSlider();

				// Redraw the map when the location name changes.
				locationInput
					.unbind(namespacedEvent("change"))
					.bind(namespacedEvent("change"), draw)

						// Prevent this form from being saved. Only blur the location input if it's selected.
					.closest("form")
						.unbind(namespacedEvent("submit"))
						.bind(namespacedEvent("submit"), function(e) {
							e.preventDefault();
							locationInput.blur();
						});

				// Kick things off.
				draw();

				// Add this plugin's namespace to the given event name.
				function namespacedEvent(eventName) {
					return eventName + "." + options.namespace;
				}

				// Coodinates taking the address provided in the location input, geocoding it,
				// and plotting it on the map with a radius.
				function draw() {
					console.log("draw");
					saveForm.addClass("loading");

					var radiusVal = radiusInput.val();
					radiusDisplay.text(radiusVal);

					geocodeLocation(locationInput.val(), function(latLng) {
						drawRadius(latLng, parseInt(radiusVal, 10));
						saveForm.removeClass("loading");
					});
				}

				// Uses the Google Map API to convert a string of text into a latitude and
				// longitude which is passed to the callback function.
				function geocodeLocation(location, callback) {
					geocoder.getLocations(location, function(response) {
						if (response && response.Status.code == 200 && response.Placemark && response.Placemark.length > 0) {
							var placemark = response.Placemark[0],
								coords = placemark.Point.coordinates,
								latLng = new GLatLng(coords[1], coords[0]),
								locationName = getLocationName(placemark);
						}

						latLng = latLng || defaultLatLng;
						latLngInput.val(latLng.lat() + "," + latLng.lng());
						setLocationName(locationName);

						callback(latLng);
					});
				}

				// Parses the response from a geocoding request and tries to create a friendly
				// name for the address to show to the user.
				function getLocationName(placemark) {
					if (placemark.AddressDetails && placemark.AddressDetails.Country
						&& placemark.AddressDetails.Country.AdministrativeArea) {

						var adminArea = placemark.AddressDetails.Country.AdministrativeArea;
						if (adminArea.Locality) {
							if (adminArea.Locality.LocalityName) {
								return adminArea.Locality.LocalityName + ", " + adminArea.AdministrativeAreaName;
							} else if (adminArea.Locality.PostalCode && adminArea.Locality.PostalCode.PostalCodeNumber) {
								return adminArea.locality.PostalCode.PostalCodeNumber;
							}
						} else if (adminArea.PostalCode && adminArea.PostalCode.PostalCodeNumber) {
							return adminArea.PostalCode.PostalCodeNumber;
						}
					}

					return "";
				}

				// Take a user friendly location name and add it to the UI and
				// hidden input to be posted.
				function setLocationName(name) {
					locationDisplay.text(name);
					locationNameInput.val(name);
				}

				// Setup the slider and add a slight timeout while sliding so the map
				// isn't redrawn each time a step is hit.
				function buildSlider() {
					var drawTimeout = {
						timeout: null,
						add: function() {
							drawTimeout.remove();

							drawTimeout.timeout = window.setTimeout(function() {
								drawTimeout.timeout = null;
								draw();
							}, 400);
						},

						remove: function() {
							if (drawTimeout.timeout) {
								window.clearTimeout(drawTimeout.timeout);
								drawTimeout.timeout = null;

								// Indicate that a timeout was cleared.
								return true;
							}
						}
					};

					return $this.find('.slider').slider({
						min: options.min,
						max: options.max,
						step: options.step,
						value: radiusInput.val(),

						slide: function(e, ui) {
							var radius = ui.value || 1;
							radiusInput.val(radius);
							radiusDisplay.text(radius);

							drawTimeout.add();
						},

						stop: function(e, ui) {
							// If a redraw was queued up, clear it and redraw immediately.
							if (drawTimeout.remove()) {
								draw();
							}
						}
					});
				}

				// Keep an external reference to the circle and center marker so they
				// can be removed later.
				var circle, marker;

				// Use the Google Maps API to add a marker at the current map center point
				// and draw a circle with the given radius.
				function drawRadius(latLng, radius) {
					if (circle) {
						map.removeOverlay(circle);
					}

					if (marker) {
						map.removeOverlay(marker);
					}

					marker = new GMarker(latLng);
					map.addOverlay(marker);

					var circlePoints = [],
						bounds = new GLatLngBounds();

					// This geometry is courtesy of http://maps.forum.nu/gm_sensitive_circle2.html.
					with (Math) {
						var d = radius / 3963.189;
						var lat1 = (PI / 180) * latLng.lat();
						var lng1 = (PI / 180) * latLng.lng();

						for (var n = 0; n < 361; n++) {
							var tc = (PI / 180) * n;
							var y = asin(sin(lat1) * cos(d) + cos(lat1) * sin(d) * cos(tc));
							var dlng = atan2(sin(tc) * sin(d) * cos(lat1),cos(d) - sin(lat1) * sin(y));
							var x = ((lng1 - dlng + PI) % (2 * PI)) - PI ; // MOD function
							var point = new GLatLng(parseFloat(y * (180 / PI)),parseFloat(x * (180 / PI)));

							circlePoints.push(point);
							bounds.extend(point);
						}

						if (d < 1.5678565720686044) {
							circle = new GPolygon(circlePoints, options.color, 2, 1, options.color, 0.4);
						} else {
							circle = new GPolygon(circlePoints, options.color, 2, 1);
						}

						map.addOverlay(circle);
						map.setCenter(latLng, map.getBoundsZoomLevel(bounds));
					}
				}
			});

			// Clean up code for Google Maps.
			$(window).unload(GUnload);

			// Return this jQuery object to allow chaining.
			return this;
		}
	});
})(jQuery);
