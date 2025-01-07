const options = {
  zoomControl: false,
  zoomSnap: 0.1,
};
const map = L.map("map", options);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);

map.createPane("labels");
map.getPane("labels").style.zIndex = 349;
map.getPane("labels").style.pointerEvents = "none";
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
  {
    pane: "labels",
    opacity: 0.4,
    minZoom: 7,
  }
).addTo(map);

map.addControl(
  L.control.zoom({
    position: "topright",
  })
);

// Load crash data
d3.csv("data/crashes.csv").then((data) => {
  let activeFilter = "all"; // 'all', 'Before', 'After'

  const afterCrashes = data.filter(
    (d) =>
      d["Before/After Construction"] === "After" && d.CollisionYear === "2023"
  );

  const beforeCrashes = data.filter(
    (d) =>
      d["Before/After Construction"] === "Before" && d.CollisionYear === "2019"
  );

  const afterLayer = L.layerGroup();
  const beforeLayer = L.layerGroup();

  const hover = (marker) => {
    marker.on("mouseover", function () {
      this.setStyle({
        radius: 8,
        fillOpacity: 1,
      });
    });
    marker.on("mouseout", function () {
      this.setStyle({
        radius: 6,
        fillOpacity: 0.8,
      });
    });
  };

  const addCrashesToLayer = (crashes, layer, color) => {
    layer.clearLayers();
    crashes.forEach((crash) => {
      const marker = L.circleMarker([+crash.Latitude, +crash.Longitude], {
        fillColor: color,
        weight: 0,
        radius: 6,
        fillOpacity: 0.8,
      });

      // Add tooltip content to the marker for re-binding later
      marker.feature = {
        tooltipContent: `
            <u>Collision Time</u>: ${crash.CollisionTime}<br>
            <u>Weather Condition</u>: ${crash.Weather}<br>
            <u>Roadway Condition</u>: ${crash.RdwyConditionCode}<br>
            <u>Lighting</u>: ${crash.LightCondition}<br>
            <u>Crash Description</u>: ${crash.DirAnalysisCode}`,
      };

      // Bind initial hover and tooltip
      hover(marker);
      marker.bindTooltip(marker.feature.tooltipContent);

      layer.addLayer(marker);
    });
  };

  const toggleInteraction = (activeLayer, inactiveLayer) => {
    // Enable hover and tooltips on the active layer
    activeLayer.eachLayer((layer) => {
      layer.setStyle({ interactive: true }); // Enable interaction
      layer.on("mouseover", function () {
        this.setStyle({ radius: 8, fillOpacity: 1 });
      });
      layer.on("mouseout", function () {
        this.setStyle({ radius: 6, fillOpacity: 0.75 });
      });
      if (!layer.getTooltip()) {
        layer.bindTooltip(
          layer.feature?.tooltipContent || "No additional info"
        );
      }
    });

    // Disable hover and tooltips on the inactive layer
    inactiveLayer.eachLayer((layer) => {
      layer.setStyle({ interactive: false }); // Disable interaction
      layer.off("mouseover mouseout"); // Disable hover
      if (layer.getTooltip()) {
        layer.unbindTooltip(); // Ensure tooltip is removed
      }
    });
  };

  const calcStats = () => {
    // Calculate total crashes and injuries for before and after
    const crashesBefore = beforeCrashes.length;
    const injuriesBefore = beforeCrashes.filter(
      (d) => +d.NumberInjured > 0
    ).length;

    const crashesAfter = afterCrashes.length;
    const injuriesAfter = afterCrashes.filter(
      (d) => +d.NumberInjured > 0
    ).length;

    // Calculate percentage reductions
    const crashReduction =
      ((crashesBefore - crashesAfter) / crashesBefore) * 100 || 0;
    const injuryReduction =
      ((injuriesBefore - injuriesAfter) / injuriesBefore) * 100 || 0;

    // Format reduction values
    const formattedCrashReduction = crashReduction.toFixed(1);
    const formattedInjuryReduction = injuryReduction.toFixed(1);

    // Update the #stats div
    const statsContainer = d3.select("#stats");
    statsContainer.selectAll("*").remove(); // Clear previous content

    statsContainer
      .append("h3")
      .style("text-align", "center")
      .text(`Crash Reduction: ${formattedCrashReduction}%`);

    statsContainer
      .append("h3")
      .style("text-align", "center")
      .text(`Injury Reduction: ${formattedInjuryReduction}%`);
  };

  const updateMap = () => {
    // Update marker opacity based on the activeFilter
    afterLayer.eachLayer((layer) => {
      layer.setStyle({
        fillOpacity:
          activeFilter === "all" || activeFilter === "After" ? 0.8 : 0.2,
      });
    });

    beforeLayer.eachLayer((layer) => {
      layer.setStyle({
        fillOpacity:
          activeFilter === "all" || activeFilter === "Before" ? 0.8 : 0.2,
      });
    });

    // Ensure both layers are added to the map
    if (!map.hasLayer(afterLayer)) map.addLayer(afterLayer);
    if (!map.hasLayer(beforeLayer)) map.addLayer(beforeLayer);

    // Fit bounds to include all markers
    const allMarkers = L.featureGroup([
      ...beforeLayer.getLayers(),
      ...afterLayer.getLayers(),
    ]);
    const bounds = allMarkers.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [25, 25],
      });
    }
  };

  const updateCharts = () => {
    const chartData = [
      {
        label: "Before: Total Crashes",
        value: beforeCrashes.length,
        type: "Before",
        color: "#F40000",
      },
      {
        label: "Before: Injuries",
        value: beforeCrashes.filter((d) => +d.NumberInjured > 0).length,
        type: "Before",
        color: "#F40000",
      },
      {
        label: "After: Total Crashes",
        value: afterCrashes.length,
        type: "After",
        color: "#2D72FF",
      },
      {
        label: "After: Injuries",
        value: afterCrashes.filter((d) => +d.NumberInjured > 0).length,
        type: "After",
        color: "#2D72FF",
      },
    ];

    const chartContainer = d3.select("#chart-container");
    chartContainer.selectAll("*").remove();

    const width = document.querySelector("#side-panel").clientWidth * 0.9; // 90% of the side panel width
    const labelHeight = 60; // Approximate height for rotated labels
    const baseHeight = 350; // Base chart height
    const dynamicHeight = baseHeight + labelHeight; // Add height for labels dynamically

    const margin = { top: 50, right: 20, bottom: 60 + labelHeight, left: 50 }; // Adjust margins

    const svg = chartContainer
      .append("svg")
      .attr("width", width)
      .attr("height", dynamicHeight);

    const xScale = d3
      .scaleBand()
      .domain(chartData.map((d) => d.label)) // Labels for each bar
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(chartData, (d) => d.value)]) // Scale up to the highest value
      .range([dynamicHeight - margin.bottom, margin.top]);

    // Draw bars with animation
    svg
      .selectAll(".bar")
      .data(chartData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.label))
      .attr("y", yScale(0)) // Start at the bottom of the chart
      .attr("width", xScale.bandwidth())
      .attr("height", 0) // Initially have zero height
      .attr("fill", (d) => d.color)
      .style("opacity", (d) =>
        activeFilter === "all" || activeFilter === d.type ? 1 : 0.2
      )
      .transition() // Add transition for animation
      .duration(1000) // Animation duration in milliseconds
      .ease(d3.easeCubicOut) // Easing function for smoother animation
      .attr("y", (d) => yScale(d.value)) // Transition to the correct y position
      .attr("height", (d) => dynamicHeight - margin.bottom - yScale(d.value)); // Transition to the correct height

    // Add labels above bars
    svg
      .selectAll(".bar-label")
      .data(chartData)
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", (d) => xScale(d.label) + xScale.bandwidth() / 2)
      .attr("y", yScale(0) - 5) // Start above the bottom
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#444")
      .text((d) => d.value)
      .transition() // Add transition for label animation
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => yScale(d.value) - 5); // Transition to the correct position

    // Add x-axis
    svg
      .append("g")
      .attr("transform", `translate(0, ${dynamicHeight - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-30)") // Rotate labels for better fit
      .style("text-anchor", "end");

    // Add y-axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale));
  };

  addCrashesToLayer(beforeCrashes, beforeLayer, "#F40000");
  addCrashesToLayer(afterCrashes, afterLayer, "#2D72FF");

  updateMap();
  updateCharts();
  calcStats();

  // Event listener for dropdown changes
  d3.select("#selectionControl").on("change", function () {
    activeFilter = this.value;

    if (activeFilter === "Before") {
      toggleInteraction(beforeLayer, afterLayer);
    } else if (activeFilter === "After") {
      toggleInteraction(afterLayer, beforeLayer);
    } else {
      // Enable hover for all layers if "all" is selected
      beforeLayer.eachLayer((layer) => {
        layer.setStyle({ interactive: true });
        layer.on("mouseover", function () {
          this.setStyle({ radius: 8, fillOpacity: 1 });
        });
        layer.on("mouseout", function () {
          this.setStyle({ radius: 6, fillOpacity: 0.75 });
        });
        if (!layer.getTooltip()) {
          layer.bindTooltip(
            layer.feature?.tooltipContent || "No additional info"
          );
        }
      });

      afterLayer.eachLayer((layer) => {
        layer.setStyle({ interactive: true });
        layer.on("mouseover", function () {
          this.setStyle({ radius: 8, fillOpacity: 1 });
        });
        layer.on("mouseout", function () {
          this.setStyle({ radius: 6, fillOpacity: 0.75 });
        });
        if (!layer.getTooltip()) {
          layer.bindTooltip(
            layer.feature?.tooltipContent || "No additional info"
          );
        }
      });
    }
    updateMap(); // Update map markers
    updateCharts(); // Update chart opacity
    calcStats();
  });
});

// Additional helper function for adding divs dynamically
d3.select("#ui-controls").append("div").attr("id", "chart-container");
