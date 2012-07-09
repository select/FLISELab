/************ GLOBAL VAR ******************/
var graph_data = [];//Data to be displayed and processed
var graph_time = [];//Data for the original recorded time
var g;//Graph variable (from dygraph)
var g2;//Graph variable for preprocessing result
var smooth_val;//Smoothing roller tool value (just for dygraph, not for preprocessing)
var cur_id;//ID of the Flise-file
$('#create_record').slideDown();
$('.current_record').hide();

//Global variables to save
var cutT;
var nocutT;
var dropT;
var eventT;

//Global variables not to save
var prevcutT;
var prevnocutT;
var prevdropT;
var preveventT;
var dataT;
var isSelecting;
var isDrawing=false;
var tool;

/************ Preload *********************/
var series_template = '';
$.get('{{=URL(request.application, 'static/templates','series_options.html')}}', function(data) { series_template = data; });
var global_template = '';
$.get('{{=URL(request.application, 'static/templates','global_options.html')}}', function(data) { global_template = data; });

/************************************/
/*var before = {
	setup: function () {
		cookies = document.cookie.split('; ')
		for (var i = 0, c; (c = (cookies)[i]) && (c = c.split('=')[0]); i++) {
			document.cookie = c + '=; expires=' + new Date(0).toUTCString();
		}
	}
};
if($.cookie('flise_js_options')== null) $.cookie('flise_js_options', 'a=10', { expires: 30, path: '/' });
*/

/**************** INIT ********************/
function init_file(cur_id,name){
	//Show data extraction zone
	$('#edit_record').slideUp();
	$('#section_data').parent().attr('style','width:490px');
	$('#section_data').show('slow');
	//Show which file is selected
	
	$('.current_record').html(name);
	$('.current_record').attr('id', cur_id);
	$('.current_record').show();
	//Rearrange which panel is developped or not
	$('#create_record').slideUp();
	$('#edit_record').slideDown();
	$('#series_options').slideUp();
	$('#global_options').slideUp();
	$('#section_file').slideToggle();
	
	//Load Raw Data Description Panel
	web2py_component('{{=URL('file')}}/'+cur_id,'edit_record')
	
	//Load time-series and associated data, then display graph and initiate callbacks			
	$.getJSON('{{=URL('get_data.json')}}/'+cur_id,function(data){
		//Load raw data
		graph_data = data.result;
		graph_time = data.timepoint;
		//Load segmentation variables
		cutT = undefined; //Array of time point
		nocutT = undefined; //Array of Array([start,end])
		dropT = undefined; //Array of Array([start,end])
		eventT = undefined; //Array or list
		//Present state
		get_set_flisefile_option(cur_id, 'cutT');
		get_set_flisefile_option(cur_id, 'nocutT');
		get_set_flisefile_option(cur_id, 'dropT');
		get_set_flisefile_option(cur_id, 'eventT');
		//Previous state
		prevcutT = [];
		prevnocutT = [];
		prevdropT = [];
		preveventT = [];
		dataT = [];
		//Reset the global graph object "g"
		g=undefined;
		g2=undefined;
		//Create "g": main series plot
		graph_labels = data.labels;
		createGraph(graph_data, data.labels);
		//Initiate graph underlaycallback based on cutT, etc...
		unifyT();
		//Display events if they are some
		var anns = g.annotations(); //=[];
		for (var iE=0; iE<eventT.length; iE++) {
			for (var series_id=-1;series_id<graph_data[0].length-1;series_id++){
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:eventT[iE], series_id:series_id},
					traditional: true,
					success: function(data){
						if (!(Object.getOwnPropertyNames(data).length === 0)){
							//add it to g annotations
							if (data['series_id']==-1){
								for (var i = 0; i < g.colors_.length; i++) {
									anns.push({
										series: g.user_attrs_['labels'][i+1],
										xval: data['time'],
										icon: '/flise/static/icons/mark-event.png',
										width: 16,
										height: 16,
										tickHeight: 2,
										text: data['type']
									});
								}
							} else {
								anns.push({
									series: data['series_name'],
									xval: data['time'],
									icon: '/flise/static/icons/mark-event.png',
									width: 16,
									height: 16,
									tickHeight: 2,
									text: data['type']
								});
							}
						}
					}
				});
			}
		}
		g.setAnnotations(anns);
		
		//Load series options and create corresponding panel
		$.getJSON('{{=URL('series_options.json')}}/'+cur_id,function(data){
			//Reset the panel
			$('#series_options').html('');
			//Color choice for timeseries
			var colors = data.color;
			//If not previously defined, use the default color from dygraph
			if (data.color == null) colors = g.colors_;
			g.updateOptions({'colors':colors, 'visibility': data.show});
			//Adapt panel HTML
			for (var i = 0;i<data.num_series;i++){
				var st = series_template;
				st = st.replace(/%select_species%/, $('#species_store > div').html());
				if(data.show[i] == true) st = st.replace(/%show%/, 'checked');
				else st = st.replace(/%show%/, '');
				st = st.replace(/%color%/, colors[i]);
				$('#series_options').append('<table id="series'+i+'">'+st+'</table>');
				$('#series'+i+' option[value="'+data.name[i]+'"]').attr('selected', 'selected');
			}
			$('.add_species').unbind('click');
			$('.add_species').click(function () {
				var new_species = $(this).parent().find('.new_species').val()
				$('select[name="select_species"]').each(function(){
					$(this).append('<option value="'+new_species+'">'+new_species+'</option>'); 
				});
				$(this).parent().find('select option[value="'+new_species+'"]').attr('selected', 'selected');
				$(this).parent().find('select').change();
			});
			//Series name input
			$('select[name="select_species"]').unbind('change');
			$('select[name="select_species"]').change(function(){
				var items = [];
				$('select[name="select_species"]').each(function(){
					if (! $(this).val() ) items.push('Species');
					else items.push($(this).val());
				});
				items = items.slice(0,-1)
				//Save new series name
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'series_species', val: items},
					traditional: true
				});
				var listSim=[];
				var flag=false;
				var iL;
				for (var i=0; i<items.length-1; i++){
					//find if it belongs to one list of similarities
					flag=false;
					if (!(listSim==[])){
						for (var iL1=0;iL1<listSim.length;iL1++){
							for (var iL2=0;iL2<listSim[iL1].length;iL2++){
								if (listSim[iL1][iL2]==i){
									flag=true;
									break;
								}
							}
							if (flag){break;}
						}
					}
					//if not...
					if (!flag){
						iL=listSim.length;
						listSim[iL]=[i];
						//find companions
						for (var j=i+1; j<items.length; j++){
							if (items[i]==items[j]){
								listSim[iL].push(j);
							}
						}
						//alter names with index so that graph labels are different
						if (listSim[iL].length>1){
							for (var j=0; j<listSim[iL].length; j++){
								items[listSim[iL][j]]=items[listSim[iL][j]]+j;
							}
						}
					}
				}
				items.splice(0,0,"Time");
				g.updateOptions({'labels':items});
			});
			//Color picker creation
			$('input[name="color"]').colorPicker();
			$('input[name="color"]').change(function(){
				var items = [];
				$('input[name="color"]').each(function(){
					items.push($(this).val());
				});
				g.updateOptions({'colors':items, 'file': graph_data});
				//Save color change
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'series_colors', val: items},
					traditional: true
				});
			});
			//Check box to activate or not display of series
			$('input[name="show"]').unbind('click');
			$('input[name="show"]').click(function(){
				var vis = []
				$('input[name="show"]').each(function (){
					if ($(this).is(':checked')) vis.push(true);
					else vis.push(false);
				});
				//Pass visibility option to graph object
				g.updateOptions({visibility: vis});
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'series_show', val: vis},
					traditional: true
				});
			});
			//now that the series have a correct naming, disp event
			g.setAnnotations(g.annotations());
			//disp panel
			$('#series_options').slideDown();
		});
		
		//Load global series options and create corresponding panel
		$.getJSON('{{=URL('global_options.json')}}/'+cur_id,function(data){
			//Reset the panel
			$('#global_options').html('');
			//Adapt panel HTML
			var st = global_template;
			//st = st.replace(/%strain_ref%/, data.strain);
			st = st.replace(/%strain_ref%/, $('#strains_store > div').html());
			st = st.replace(/%comments%/, data.comments);
			if (data.smooth == true) st = st.replace(/%smooth%/, 'checked');
			else st = st.replace(/%smooth%/, '');
			st = st.replace(/%smooth_value%/, data.smooth_value);
			if(data.od == null) st = st.replace(/%od%/, '');
			else st = st.replace(/%od%/, data.od);
			st = st.replace(/%dilutionf%/, data.dilution);
			st = st.replace(/%celldiameter%/, data.celld);
			$('#global_options').append('<table>'+st+'</table>');
			$('select[name="select_strain"]').attr('name','select_strain_global');
			if (!(data.strain_id==null)) $('select[name="select_strain_global"] option[value="'+data.strain_id+'"]').attr('selected', 'selected');
			//Strain reference input
			$('select[name="select_strain_global"]').unbind('change');
			$('select[name="select_strain_global"]').change(function(){
				//Save new strain reference
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'strain_id', val: parseInt($(this).val())}, //BUG
					traditional: true
				});
			});
			//OD input
			$('input[name="od"]').unbind('change');
			$('input[name="od"]').change(function(){
				//Save OD
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'optical_density', val: $(this).val()},
					traditional: true
				});
			});
			//Dilution factor input
			$('input[name="dilutionf"]').unbind('change');
			$('input[name="dilutionf"]').change(function(){
				//Save dilution factor
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'dilution_factor', val: $(this).val()},
					traditional: true
				});
			});
			//Cell diameter input
			$('input[name="celldiameter"]').unbind('change');
			$('input[name="celldiameter"]').change(function(){
				//Save cell diameter
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'cell_diameter', val: $(this).val()},
					traditional: true
				});
			});
			//Comments free text area
			$('textarea[name="comments"]').unbind('change');
			$('textarea[name="comments"]').change(function(){
				//Save comments
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'comments', val: $('textarea[name="comments"]').val()},
					traditional: true
				});
			});
			//Init slider
			smooth_val = data.smooth_value;
			//Update graph "g" options
			if (data.smooth) g.updateOptions({file: graph_data, rollPeriod: smooth_val});
			else g.updateOptions({file: graph_data, rollPeriod: 1});
			//Activate smoothing (only on "g")
			$('input[name="smooth"]').unbind('click');
				$('input[name="smooth"]').click(function(){
				//Save checked state
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'disp_smooth', val: $(this).is(':checked')},
					traditional: true
				});
				//Apply visual smoothing
				if ($(this).is(':checked')) g.updateOptions({file: graph_data, rollPeriod: smooth_val});
				else g.updateOptions({file: graph_data, rollPeriod: 1});
			});
			$('input[name="smooth_val"]').unbind();
			//Value next to slider
			$('input[name="smooth_val"]').each(function(){
				$(this).parent().find('span').html($(this).val());
			});
			//Update smooth value
			$('input[name="smooth_val"]').change(function(){
				$(this).parent().find('span').html($(this).val());
			});
			$('input[name="smooth_val"]').mouseup(function(){
				//Save new smooth_value
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'disp_smooth_value', val: $(this).val()},
					traditional: true
				});
				smooth_val = parseFloat($(this).attr("value"));
				if ($('input[name="smooth"]').is(':checked')) g.updateOptions({file: graph_data, rollPeriod: smooth_val});
			});
			$('#global_options').slideDown();
		});
		
		// Load autosegmentation panel
		$.get('{{=URL(request.application, 'static/templates','autoseg_options.html')}}', function(data) {
			//Reset the panel
			$('#autoseg_options').html('');
			//Create panel
			$('#autoseg_options').append(data);
			//Value next to slider
			$('input[class="segmentation_slider"]').each(function(){
				$(this).parent().find('span').html($(this).val());
			});
			$('input[class="segmentation_slider"]').change(function(){
				$(this).parent().find('span').html($(this).val());
			});
			//Autosegmentation start button
			// -here: when we launch autosegmentation, the button is disabled, as well as the Undo button from Tools panel, and only the Revert button is unabled.
			$('#autoseg').unbind('click');
			$('#autoseg').click(function(){
				$("#autoseg").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				$("#revert_tool").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				autoseg(graph_data);
				$("#revertseg").removeAttr("disabled").removeAttr("style");
			});
			//Autosegmentation revert button
			// -here: when we go back to previous state, the button is disabled, and only the start button is unabled. The Undo button is not restored since we store only one previous state. The "Undo" and "Revert" are redundant, but it is for sake of clarity since they don't belong to the same panel.
			$('#revertseg').unbind('click');
			$('#revertseg').click(function(){
				$("#revertseg").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				// -here: we use the Array.slice() method since otherwise the Array object is passed by reference.
				cutT = prevcutT.slice();
				nocutT = prevnocutT.slice();
				dropT = prevdropT.slice();
				eventT = preveventT.slice();
				unifyT();
				$("#autoseg").removeAttr("disabled").removeAttr("style");
			});
			//Default button unabling
			$("#autoseg").removeAttr("disabled").removeAttr("style");
			$("#revertseg").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
		});
		
		//Load Tools panel
		$.get('{{=URL(request.application, 'static/templates','tools.html')}}', function(data) {
			//Initialize tool variables
			isSelecting = false;
			tool = 'zoom';//Default tool
			
			//Reset panel
			$('#tools').html('');
			//Load the panel
			$('#tools').append(data);
			
			//Load Tool Export panel
			$.get('{{=URL(request.application, 'static/templates','export.html')}}', function(data) {
				//Reset panel
				$('#export').html('');
				//Load the panel
				$('#export').append(data);
				
				//Initialize default tool
				change_tool(document.getElementById("tool_"+tool));
			});
			
			//Undo button (see button Revert in Autosegmentation panel)
			$('#revert_tool').unbind('click');
			$('#revert_tool').click(function(){
				$("#revert_tool").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				cutT = prevcutT.slice();
				nocutT = prevnocutT.slice();
				dropT = prevdropT.slice();
				eventT = preveventT.slice();
				unifyT();
			});
			$("#revert_tool").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
		});
		
		//Load preprocessing panel
		$.get('{{=URL(request.application, 'static/templates','preprocessing.html')}}', function(data) {
			//Reset panel
			$('#deriv').html('');
			//Load panel
			$('#deriv').append(data);
			//Value next to slider
			$('input[class="savgol_slider"]').each(function(){
				$(this).parent().find('span').html($(this).val());
			});
			$('input[class="savgol_slider"]').change(function(){
				$(this).parent().find('span').html($(this).val());
			});
			//Force local window to be big enought for polynomial order: min loc half window (lochw) of size 6 and max polynomial order (porder) of 10 insures that porder<2*lochw.
			//Preprocessing button
			$('#preproc').unbind('click');
			$('#preproc').click(function(){
				//Disable button
				$("#preproc").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				$("#preproc_close").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				//Get processing parameters
				var lochw = parseFloat($("#lochw").attr("value"));
				var porder = parseFloat($("#order").attr("value"));
				//Shape data to smooth/derivate
				var data2derive=[];
				var Tsamp=(graph_data[1][0]-graph_data[0][0]);
				var iDpass=0;
				for (var iD=0; iD<dataT.length; iD++){
					//prevent small intervals to be passed
					if (Math.ceil((dataT[iD][1]-dataT[iD][0])/Tsamp)<=(2*lochw+1)){
						iDpass++;
						continue;
					}
					//collect interval
					data2derive.push([]);
					for (var iS=1; iS<graph_data[0].length;iS++){
						data2derive[iD-iDpass].push([]);
						data2derive[iD-iDpass][iS-1]=[];
						for (var iP=0; iP<graph_data.length;iP++){
							if ((graph_data[iP][0]>=dataT[iD][0])&&(graph_data[iP][0]<=dataT[iD][1])){
								data2derive[iD-iDpass][iS-1].push(graph_data[iP][iS]);
							}
						}
					}
				}
				//Pass it to Savgol module
				$.ajax({
					url: '{{=URL('get_savgol.json')}}',
					data: {w:lochw,order:porder,deriv:1,data:JSON.stringify(data2derive)},
					traditional: true,
					type: 'POST',
					success: function(data){
						var result = data.result;
						g.resize(window.innerWidth-510, Math.floor((window.innerHeight-90)/2));
						//Shape data to plot
						var data2plot=[];
						for (var iP=0; iP<graph_data.length;iP++){
							//initialize to null
							data2plot.push([graph_data[iP][0]]);//recopy time
							for (var iS=1; iS<graph_data[0].length;iS++){
								data2plot[iP].push(null);
							}
						}
						var Tsamp=(graph_data[1][0]-graph_data[0][0]);
						var iIpass=0;
						for (var iI=0; iI<dataT.length; iI++){
							//prevent small intervals to be passed
							if (Math.ceil((dataT[iI][1]-dataT[iI][0])/Tsamp)<=(2*lochw+1)){
								iIpass++;
								continue;
							}
							//find index when graph_data[iP][0]==dataT[iI][0]
							for (iP=0; iP<graph_data.length;iP++){
								if (graph_data[iP][0]==dataT[iI][0]){break;}
							}
							//place values
							for (iS=0; iS<result[iI-iIpass].length;iS++){
								for (var iP2=0; iP2<result[iI-iIpass][iS].length;iP2++){
									data2plot[iP+iP2][iS+1]=result[iI-iIpass][iS][iP2];
								}
							}
						}
						//Plot
						$('#graphdiv2').show();
						var derivlabels=['Time'];
						for (var i=0; i<g.colors_.length; i++){
							derivlabels.push('Deriv'+i);
						}
						g2 = new Dygraph(document.getElementById("graphdiv2"), data2plot,
							{
								labels: derivlabels,
								colors: g.colors_,
								dateWindow: g.xAxisRange(),
								width: window.innerWidth-510,
								height: Math.floor((window.innerHeight-90)/2),
								strokeWidth: 0.5,
								gridLineColor: 'rgb(196, 196, 196)',
								logscale : false,
								drawCallback: function(me, is_initial){
									if (is_initial){return;}
									if (!isDrawing){
										isDrawing=true;
										var range = me.xAxisRange();
										g.updateOptions( {
										  dateWindow: range
										} );
										isDrawing=false;
									}
								},
								interactionModel: {
									mousedown: function (event, me, context) {
										if (tool == 'zoom') {
											Dygraph.defaultInteractionModel.mousedown(event, me, context);
										}
									},
									mousemove: function (event, me, context) {
										if (tool == 'zoom') {
											Dygraph.defaultInteractionModel.mousemove(event, me, context);
										}
									},
									mouseup: function(event, me, context) {
										if (tool == 'zoom') {
											Dygraph.defaultInteractionModel.mouseup(event, me, context);
										}
									},
									mouseout: function(event, me, context) {
										if (tool == 'zoom') {
											Dygraph.defaultInteractionModel.mouseout(event, me, context);
										}
									},
									dblclick: function(event, me, context) {
										if (tool == 'zoom') {
											Dygraph.defaultInteractionModel.dblclick(event, me, context);
										}
									},
									mousewheel: function(event, me, context) {
										var normal = event.detail ? event.detail * -1 : event.wheelDelta / 40;
										var percentage = normal / 50;
										var axis = me.xAxisRange();
										var xOffset = me.toDomCoords(axis[0], null)[0];
										var x = event.offsetX - xOffset;
										var w = me.toDomCoords(axis[1], null)[0] - xOffset;
										var xPct = w == 0 ? 0 : (x / w);
								
										var delta = axis[1] - axis[0];
										var increment = delta * percentage;
										var foo = [increment * xPct, increment * (1 - xPct)];
										var dateWindow = [ axis[0] + foo[0], axis[1] - foo[1] ];
								
										me.updateOptions({
											dateWindow: dateWindow
										});
										Dygraph.cancelEvent(event);
									}
								}
							});
						// Enable close plot button
						$("#preproc_close").removeAttr("disabled").removeAttr("style");
						// Enable button
						$("#preproc").attr("value", "Extract, reprocess and plot").removeAttr("disabled").removeAttr("style");
					}
				});
			});
			$('#preproc_close').unbind('click');
			$('#preproc_close').click(function(){
				$("#preproc_close").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				$("#preproc").attr("value", "Extract, process and plot");
				g2=undefined;
				$('#graphdiv2').hide();
				$('#graphdiv2:parent').html('<div id="graphdiv2"></div>');
				g.resize(window.innerWidth-510, (window.innerHeight-90));
			});
			//Default button unabling
			$("#preproc_close").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
		});
	});
}

function init_files(){
	//Select a file (click behavior)
	$('.flise_file .select').click(function(){
		cur_id = $(this).parent().attr('id');
		init_file(cur_id, $(this).html());
	});
	//Files Delete button
	$('.del').unbind('click');
	$('.del').click(function(){
		$(this).parent().remove();
		$.ajax({
			url:'{{=URL('file')}}',
			data: {delr: $(this).parent().attr('id')}
		});
	});
	$('.del').confirm({
		stopAfter:'ok',
		wrapper: '<div class="del"></div>',
		timeout:3000
	}); 
}

/**************** WINDOW RESIZE *********************/
jQuery(document).ready(function(){
	 $(window).resize(function(){
		 if (g != undefined){g.resize(window.innerWidth-530, window.innerHeight-90);}
	 });
});

/******************* AUTO-SEG ************************/
listMath = function(list){
    var r = {mean: 0, variance: 0, std: 0, minV: 0, maxV: 0}, t = list.length;
	for(var ma = list[t-1], mi = list[t-1], l = t-1; l--; ma = Math.max(ma,list[l]), mi = Math.min(mi,list[l]));
    for(var m, s = 0, l = t; l--; s += list[l]);
    for(m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(list[l] - m, 2));
    return r.std = Math.sqrt(r.variance = s / t), r.minV = mi, r.maxV = ma, r;
}
function array2col(arrayOfArray, colNum){
	var list = new Array();
	if (colNum>arrayOfArray[0].length-1){return list;}
	for (var i = 0; i < arrayOfArray.length-1; i++) {
			list.push(arrayOfArray[i][colNum]);
	}
	return list;
}

function autoseg(data){
	//Load slider values
	var w = parseFloat($("#locw").attr("value")); //Number of points to the right and to the left to consider: must be a positive 
	
	var dataLocVar = new Array();
	var x = listMath([1, 2, 3]);//whatever, just to initialize
	if (data.length>w){
		//Backup previous state
		prevcutT = cutT.slice();
		prevnocutT = nocutT.slice();
		prevdropT = dropT.slice();
		preveventT = eventT.slice();
		
		//Calculate data local variation
		for (var i = w; i < data.length-w; i++) {
			dataLocVar[i] = new Array();
			for (var j = 1; j < data[0].length; j++) {
				x = listMath(array2col(data.slice(i-w,i+w),j));
				dataLocVar[i][j-1]=x.std;
			}
		}
		for (var i = 0; i < w; i++) {
			dataLocVar[i] = new Array();
			for (var j = 1; j < data[0].length; j++) {
				dataLocVar[i][j-1]=dataLocVar[w][j-1];
			}
		}
		for (var i = data.length-w; i < data.length; i++) {
			dataLocVar[i] = new Array();
			for (var j = 1; j < data[0].length; j++) {
				dataLocVar[i][j-1]=dataLocVar[data.length-w-1][j-1];
			}
		}
		//Calculate frequencies of values of local std
		var histcount = new Array();
		var ldata = new Array();
		for (var j = 0; j < dataLocVar[0].length; j++) {
			ldata = ldata.concat(array2col(dataLocVar,j));
		}
		x = listMath(ldata);
		var histx = new Array();
		var step = (x.maxV - x.minV)/2000*1.0003;
		for (var i = 0; i <= 2000; i++) {
			histx[i] = x.minV + i*step;
			histcount[i] = [0,0];
		}
		for (var i = 0; i < dataLocVar.length; i++) {
			for (var j = 0; j < dataLocVar[0].length; j++) {
				for (var ii = 0; ii < 2000; ii++) {
					if (dataLocVar[i][j]>=histx[ii] && dataLocVar[i][j]<histx[ii+1]){
						histcount[ii][j]++;
						break;
					}
				}
			}
		}
		for (var i = 0; i < 2000; i++) {
			for (var j = 0; j < histcount[0].length; j++) {
				histcount[i][j] = histcount[i][j]*100/data.length;
			}
		}
		//Find thresholds
		var threshold = new Array();
		for (var i = 0; i < 2000; i++) {
			for (var j = 0; j < histcount[0].length; j++) {
				//find max histx so that histcount (quantile) is greater than 1%
				if (histcount[i][j]>1){
					threshold[j]=histx[i];
				}
			}
		}
		//Find position where all dataLocVar are above their threshold
		var index = new Array();
		var flag = true;
		for (var i = 0; i < dataLocVar.length; i++) {
			flag = true;
			for (var j = 0; j < dataLocVar[0].length; j++) {
				if (dataLocVar[i][j]<threshold[j]){
					flag = false;
					break
				}
			}
			if (flag){
				index.push(i);
			}
		}
		//Convert to interval
		var prev = index[0]-1;
		var intDrop = new Array([index[0], -1]);
		for (var i = 0; i < index.length; i++) {
			if (index[i]-1 != prev){
				intDrop[intDrop.length-1][1]=prev;
				intDrop.push([index[i], 0]);
			}
			prev = index[i];
		}
		intDrop[intDrop.length-1][1]=prev;
		//Additionnaly we will fuse those intDrop intervals if the interval between them is with dataLocVar>threshold for at least one series
		//Find position where some dataLocVar are above their threshold
		var index2 = new Array();
		for (var i = 0; i < dataLocVar.length; i++) {
			flag = false;
			for (var j = 0; j < dataLocVar[0].length; j++) {
				if (dataLocVar[i][j]>=threshold[j]){
					flag = true;
					break
				}
			}
			if (flag){
				index2.push(i);
			}
		}
		//Convert to interval
		var prev = index2[0]-1;
		var intVar = new Array([index2[0], -1]);
		for (var i = 0; i < index2.length; i++) {
			if (index2[i]-1 != prev){
				intVar[intVar.length-1][1]=prev;
				intVar.push([index2[i], 0]);
			}
			prev = index2[i];
		}
		intVar[intVar.length-1][1]=prev;
		//Fuse and/or extend intDrop
		var indInt = new Array();
		for (var i = 0; i < intVar.length; i++) {
			//Find all intDrop in contact with this intVar[i]
			indInt = [];
			for (var j = 0; j < intDrop.length; j++) {
				if (intDrop[j][1]>=intVar[i][1] && intDrop[j][2]<=intVar[i][2]){
					indInt.push(j);
				} else {
					if (indInt.length!=0){
						break
					}
				}
			}
			//Modify and remove unnecessary elements
			if (indInt.length>0){
				intDrop[indInt[0]][1]=intVar[i][1];
				intDrop[indInt[0]][2]=intVar[i][2];
				if (indInt.length>1){
					intDrop.splice(indInt[1],indInt.length-1);
				}
			}
		}
		//Cleaning up by removing intervals that are too small and shrinking the rest to take into account the windowing of size w
		step = Math.ceil(w/2);
		for (var i = 0; i < intDrop.length; i++) {
			if (intDrop[i][1]-step > intDrop[i][0]+step){
				intDrop[i][1]=intDrop[i][1]-step;
				intDrop[i][0]=intDrop[i][0]+step;
			} else {
				intDrop.splice(i,1);
				i--;
			}
		}
		
		//Fusing nearby zones
		var wF = parseFloat($("#fusw").attr("value"));
		for (var i = 1; i < intDrop.length; i++) {
			if (intDrop[i][0]-intDrop[i-1][1]<wF){
				intDrop[i-1][1]=intDrop[i][1];
				intDrop.splice(i,1);
				i--;
			}
		}
		
		//Passing them to graph and global variables
		var Tstep = data[1][0]-data[0][0];
		//Add
		var startX, endX;
		var insertT;
		var countHowMany, indexI;
		for (var i = 0; i < intDrop.length; i++) {
			startX = intDrop[i][0]*Tstep;
			endX = intDrop[i][1]*Tstep;
			//If array is empty, initialize
			if (dropT.length==0){
				dropT.push([startX, endX])
			} else {
				//Test if [s,e] overlaps with any already existing dropT interval, in which case it joins them.
				insertT = false;
				flag = true;
				for (j=0; j<dropT.length; j++) {
					if ((endX<=dropT[j][1])&&(startX>=dropT[j][0])){
						flag = false;
						break;
					} else {
						if ((endX>dropT[j][0])&&(startX<dropT[j][0])){
							insertT = true;
							dropT[j][0]=startX;
						}
						if ((endX>dropT[j][1])&&(startX<dropT[j][1])){
							insertT = true;
							dropT[j][1]=endX;
						}
					}
				}
				//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
				//otherwise, add the new segment at correct position so that it is sorted in increasing order.
				if (flag){
					if (insertT){
						countHowMany = 0;
						indexI = 0;
						for (j=1; j<dropT.length; j++) {
							if (dropT[j-1][1]>=dropT[j][0]){
								countHowMany++;
								if (indexI==0){
									indexI=j;
								}
								dropT[indexI-1][1]=dropT[j][1];
							} else if (indexI!=0) {
								j=j-countHowMany;
								dropT.splice(indexI, countHowMany);
								indexI = 0;
								countHowMany = 0;
							}
							if ((indexI!=0)&&(i==dropT.length-1)) {
								dropT.splice(indexI, countHowMany);
							}
						}
					} else {
						flag = true;
						if (endX<dropT[0][0]){
							dropT.splice(0,0,[startX, endX]);
							flag = false;
						} else {
							for (j=1; j<dropT.length; j++) {
								if ((endX<dropT[j][0])&&(startX>dropT[j-1][1])){
									dropT.splice(j,0,[startX, endX]);
									flag = false;
									break;
								}
							}	
						}
						if (flag){
							dropT.push([startX, endX]);
						}
					}
				}
			}
		}
		unifyT();
	}
}

/******************* SUBINTERVAL ************************/
function interval2export(pos) {
	//Find interval
	var flag = true;
	var intStart, intEnd;
	for (iD=0; iD<dataT.length; iD++){
		if ((dataT[iD][0]<pos)&&(dataT[iD][1]>pos)){
			intStart=dataT[iD][0];
			intEnd=dataT[iD][1];
			flag = false;
			break;
		}
	}
	if (flag) return;
	
	var strain_ref = $('select[name="select_strain_global"]').val();
	var comments = $('textarea[name="comments"]').val();
	var od = $('input[name="od"]').val();
	var dilutionf = $('input[name="dilutionf"]').val();
	var celldiameter = $('input[name="celldiameter"]').val();
	var name = '';
	
	$.ajax({
		url: '{{=URL("store_subint_option.json")}}',
		data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd},
		traditional: true,
		success: function(subintervals_data){
			if (Object.getOwnPropertyNames(subintervals_data).length === 0){
				//create it
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'strain_id', val: strain_ref},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'comments', val: comments},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'name', val: name},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'optical_density', val: od},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'dilution_factor', val: dilutionf},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'cell_diameter', val: celldiameter},
					traditional: true
				});
			} else {
				//load values
				strain_ref = subintervals_data['strain_id'];
				comments = subintervals_data['comments'];
				name = subintervals_data['name'];
				od = subintervals_data['optical_density'];
				dilutionf = subintervals_data['dilution_factor'];
				celldiameter = subintervals_data['cell_diameter'];
			}
			//Temp subinterval options and create corresponding panel
			$.get('{{=URL(request.application, 'static/templates','subinterval.html')}}', function(htmlstr) {
				//Reset the panel
				$('#subinterval').html('');
				//Adapt panel HTML
				var st = htmlstr;
				st = st.replace(/%start%/,intStart);
				st = st.replace(/%end%/,intEnd);
				st = st.replace(/%name%/, name)
				st = st.replace(/%strain_ref%/, $('#strains_store').html());
				st = st.replace(/%comments%/, comments);
				st = st.replace(/%od%/, od);
				st = st.replace(/%dilutionf%/, dilutionf);
				st = st.replace(/%celldiameter%/, celldiameter);
				//Series - Calibration
				var stcal;
				for (var i = 0;i<$('#series_options > table').size();i++){
					stcal = '<tr><td style="color:%color%">%species%</td><td>Gain: <input name="sub_calgain" type="text" value="" style="width:60px"/></td><td>Offset: <input name="sub_caloffset" type="text" value="" style="width:60px"/></td></tr>';
					stcal = stcal.replace(/%species%/, $('#series'+i+' > tbody > tr > td > select').val());
					stcal = stcal.replace(/%color%/, $('#series'+i+' > tbody > tr:eq(1) > td > table > tbody > tr > td > input').val());
					st = st.replace(/%caloptions%/,stcal+'%caloptions%');
				}
				st = st.replace(/%caloptions%/,'');
				$('#subinterval').append(st);
            $('#subinterval select[name="select_strain"][value='+strain_ref+']').attr('selected','selected');
                //jQuery('input.').live('keyup', function(){this.value=this.value.reverse().replace(/[^0-9\-]|\-(?=.)/g,'').reverse();});
                //jQuery('input.double,input.decimal').live('keyup', function(){this.value=this.value.reverse().replace(/[^0-9\-\.,]|[\-](?=.)|[\.,](?=[0-9]*[\.,])/g,'').reverse();});
				
				//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx
				//spreadsheet export
				$('#export2excel').click(function(){
					var raw_data = [];
					for (var i=0; i<graph_data.length; ++i){
						if ((graph_data[i][0]>=intStart) && (graph_data[i][0]<=intEnd)){
							raw_data.push(graph_data[i]);
						}
					}
					var data = {'1 Parameters': { header:[], 
									data: [
									['Name',$('input[name="sub_name"]').val(), ' '],
									['Strain',$('#subinterval select[name="select_strain"]').val(), $('#subinterval option:selected').html()],
									['Optical density',$('input[name="sub_od"]').val(), ' '],
									['Dilution factor',$('input[name="sub_dilutionf"]').val(), ' '],
									['Cell diameter',$('input[name="sub_celldiameter"]').val(), ' '],
									['Comments',$('input[name="sub_comments"]').val(), ' '],
									['Calibration','', ' ']
									]
								},
								'2 Raw Data': { header:graph_labels, 
									data: raw_data
								},
								'3 Processed Data': { header:graph_labels, 
									data: [graph_data[0]]
								}
							}
					$('#json2spreadsheet_form').html("<input type='hidden' value='"+JSON.stringify(data)+"' name='data'/> <input type='hidden' value='xls' name='format'/> ");
					$('#json2spreadsheet_form').submit();
				});	
				//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx
				
				//Strain reference input
				$('input[name="sub_name"]').unbind('change');
				$('input[name="sub_name"]').change(function(){
					// TODO: first check this name does not exist already for this FLISE file?
					//Save subinterval name
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'name', val: $(this).val()},
						traditional: true
					});
				});
				//Strain reference input
				$('input[name="sub_strain_ref"]').unbind('change');
				$('input[name="sub_strain_ref"]').change(function(){
					//Save new strain reference
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'strain_id', val: $(this).val()},
						traditional: true
					});
				});
				//OD input
				$('input[name="sub_od"]').unbind('change');
				$('input[name="sub_od"]').change(function(){
					//Save new strain reference
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'optical_density', val: $(this).val()},
						traditional: true
					});
				});
				//Strain reference input
				$('input[name="sub_dilutionf"]').unbind('change');
				$('input[name="sub_dilutionf"]').change(function(){
					//Save new strain reference
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'dilution_factor', val: $(this).val()},
						traditional: true
					});
				});
				//Strain reference input
				$('input[name="sub_celldiameter"]').unbind('change');
				$('input[name="sub_celldiameter"]').change(function(){
					//Save new strain reference
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'cell_diameter', val: $(this).val()},
						traditional: true
					});
				});
				//Comments free text area
				$('textarea[name="sub_comments"]').unbind('change');
				$('textarea[name="sub_comments"]').change(function(){
					//Save comments
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'comments', val: $(this).val()},
						traditional: true
					});
				});
				//Calibration
				
				//Make popup
				modal = $("#subinterval").modal({
					overlayClose:true,
					opacity:20,
				});
			});
		}
	});
}


/******************* GRAPH ************************/
function getX(canvasx, g) {
	var points = g.layout_.points;
	if (points === undefined) return;
	var xval = -1;
	//Make a guess for position, and go back 10 before
	var istart = Math.max(0,Math.floor((points[0].canvasx-canvasx)*points.length/(g.rawData_[0].length-1)/(points[0].canvasx-points[points.length-1].canvasx)-10));
	// Loop through surroundings points and find the time nearest to our current location.
	var minDist = 1e+100;
	var idx = -1;
	for (var i = istart; i < points.length; i++) {
		var point = points[i];
		if (point == null) continue;
		var dist = Math.abs(point.canvasx - canvasx);
		if (dist > minDist) break;
		minDist = dist;
		idx = i;
	}
	if (idx >= 0) xval = points[idx].xval;
	return xval;
}

function drawSelectRect(event, g, context) {
	var ctx = g.canvas_ctx_;
	
	context.dragEndX = g.dragGetX_(event, context);
	context.dragEndY = g.dragGetY_(event, context);
	
	var xDelta = Math.abs(context.dragStartX - context.dragEndX);
	var yDelta = Math.abs(context.dragStartY - context.dragEndY);
	
	/*// drag direction threshold for y axis is twice as large as x axis
	context.dragDirection = (xDelta < yDelta / 2) ? Dygraph.VERTICAL : Dygraph.HORIZONTAL;*/
	// I constrain it to horizontal direction only (otherwise comment the following and uncomment what's above.)
	context.dragDirection = Dygraph.HORIZONTAL;
	
	
	// Clean up from the previous rect if necessary
	if (context.prevDragDirection == Dygraph.HORIZONTAL) {
		ctx.clearRect(Math.min(context.dragStartX, context.prevEndX), g.layout_.getPlotArea().y,
									Math.abs(context.dragStartX - context.prevEndX), g.layout_.getPlotArea().h);
	} else if (context.prevDragDirection == Dygraph.VERTICAL){
		ctx.clearRect(g.layout_.getPlotArea().x, Math.min(context.dragStartY, context.prevEndY),
										g.layout_.getPlotArea().w, Math.abs(context.dragStartY - context.prevEndY));
	}
	
	if (tool == 'nocut'){
		ctx.fillStyle = "rgba(128,255,128,0.33)";
	} else if (tool == 'cancel') {
		ctx.fillStyle = "rgba(255,255,128,0.33)";
	} else if (tool == 'drop') {
		ctx.fillStyle = "rgba(255,128,128,0.33)";
	} else {
		ctx.fillStyle = "rgba(128,128,128,0.33)";
	}
	// Draw a light-grey (default) rectangle to show the new viewing area
	if (context.dragDirection == Dygraph.HORIZONTAL) {
		if (context.dragEndX && context.dragStartX) {
		ctx.fillRect(Math.min(context.dragStartX, context.dragEndX), g.layout_.getPlotArea().y,
					 Math.abs(context.dragEndX - context.dragStartX), g.layout_.getPlotArea().h);
		}
	} else if (context.dragDirection == Dygraph.VERTICAL) {
		if (context.dragEndY && context.dragStartY) {
		ctx.fillRect(g.layout_.getPlotArea().x, Math.min(context.dragStartY, context.dragEndY),
					 g.layout_.getPlotArea().w, Math.abs(context.dragEndY - context.dragStartY));
		}
	}
	
	context.prevEndX = context.dragEndX;
	context.prevEndY = context.dragEndY;
	context.prevDragDirection = context.dragDirection;
	}

	function eraseSelectRect(g, context) {	
	// Clean up from the previous rect
	if (context.prevDragDirection == Dygraph.HORIZONTAL) {
	g.canvas_ctx_.clearRect(Math.min(context.dragStartX, context.prevEndX), g.layout_.getPlotArea().y,
					Math.abs(context.dragStartX - context.prevEndX), g.layout_.getPlotArea().h);
	} else if (context.prevDragDirection == Dygraph.VERTICAL){
	g.canvas_ctx_.clearRect(g.layout_.getPlotArea().x, Math.min(context.dragStartY, context.prevEndY),
					g.layout_.getPlotArea().w, Math.abs(context.dragStartY - context.prevEndY));
	}	
	// Update point display
	g.updateSelection_();  
}

function drawDataZone(g, ctx, startX, endX, color) {
	var range = g.yAxisRange();
	var p1 = g.toDomCoords(startX, range[0]);
	var p2 = g.toDomCoords(endX, range[1]);
	// Draw a light-colored rectangle to show the new viewing area
	ctx.fillStyle = "rgba("+color[0]+","+color[1]+","+color[2]+",0.25)";
	ctx.fillRect(Math.min(p1[0], p2[0]), g.layout_.getPlotArea().y+g.layout_.getPlotArea().h/24,Math.abs(p1[0]-p2[0]), g.layout_.getPlotArea().h*23/24);
}

function drawInterval(g, ctx, startX, endX, color) {
	var range = g.yAxisRange();
	var p1 = g.toDomCoords(startX, range[0]);
	var p2 = g.toDomCoords(endX, range[1]);
	// Draw a light-colored rectangle to show the new viewing area
	ctx.fillStyle = "rgba("+color[0]+","+color[1]+","+color[2]+",0.66)";
	ctx.fillRect(Math.min(p1[0], p2[0]), g.layout_.getPlotArea().y,Math.abs(p1[0]-p2[0]), g.layout_.getPlotArea().h/24);
}

function drawVerticalLine(g, ctx, x, color) {
	var range = g.yAxisRange();
	var p1 = g.toDomCoords(x, range[1]);
	var p2 = g.toDomCoords(x, range[1]-Math.abs(range[1]-range[0])/24);
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.0;
	ctx.beginPath();
	ctx.moveTo(p1[0], p1[1]);
	ctx.lineTo(p2[0], p2[1]);
	ctx.closePath();
	ctx.stroke();
	ctx.restore(); 
}

function finishSelect() {
	isSelecting = false;
}

function save2undo(){
	//Backup previous state
	prevcutT = cutT.slice();
	prevnocutT = nocutT.slice();
	prevdropT = dropT.slice();
	preveventT = eventT.slice();
	$("#revert_tool").removeAttr("disabled").removeAttr("style");
	$("#revertseg").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
	$("#autoseg").removeAttr("disabled").removeAttr("style");
}

function get_set_flisefile_option(record_id, var_name){
	var data = {record_id:record_id, var_name:var_name};
	if(window[var_name] != undefined){
		data.val = JSON.stringify(window[var_name]);
	}
	$.ajax({
		dataType: 'json',
		async: false,
		url: '{{=URL('store_option.json')}}',
		data: data,
		success: function(data){
			if (window[var_name] == undefined){
				if (data != null) window[var_name] = JSON.parse(data);
				else window[var_name] = [];
			}
		}
	});
}

function unifyT() {
	//Drop tool defines intervals to ignore (data to trash), therefore it has priority (one cannot insert a cut point or a nocut interval in a drop zone)
	for (var iD=0; iD<dropT.length; iD++) {
		for (var iC=0; iC<cutT.length; iC++) {
			if (cutT[iC]>dropT[iD][1]){break}
			if ((cutT[iC]>=dropT[iD][0])&&(cutT[iC]<=dropT[iD][1])){
				cutT.splice(iC,1);
				iC--;
			}
		}
		for (var iN=0; iN<nocutT.length; iN++) {
			if (nocutT[iN][0]>dropT[iD][1]){break}
			if ((nocutT[iN][0]>=dropT[iD][0])&&(nocutT[iN][1]<=dropT[iD][1])){
				nocutT.splice(iN,1);
				iN--;
			} else if ((nocutT[iN][0]<dropT[iD][0])&&(nocutT[iN][1]>dropT[iD][0])){
				if(nocutT[iN][1]>dropT[iD][1]){
					nocutT.splice(iN, 1, [nocutT[iN][0], dropT[iD][0]], [dropT[iD][1], nocutT[iN][1]]);
				} else {
					nocutT[iN][1]=dropT[iD][0];
				}
			} else if ((nocutT[iN][0]<dropT[iD][1])&&(nocutT[iN][1]>dropT[iD][1])){
				//here we should have (nocutT[iN][0]>dropT[iD][0]) only
				nocutT[iN][0]=dropT[iD][1];
			}
		}
	}
	//Cut has priority over nocut interval.
	for (iC=0; iC<cutT.length; iC++) {
		for (iN=0; iN<nocutT.length; iN++) {
			if ((nocutT[iN][0]<cutT[iC])&&(nocutT[iN][1]>cutT[iC])){
				nocutT.splice(iN, 0, [nocutT[iN][0], cutT[iC]]);
				nocutT[iN+1][0]=cutT[iC];
			}
		}
	}
	//Data zones are intervals between drop zones and cuts.
	var prevdataT = dataT;
	dataT = [];
	dataT.push([0]);
	for (iD=0; iD<dropT.length; iD++) {
		dataT[dataT.length-1].push(dropT[iD][0]);
		dataT.push([dropT[iD][1]]);
	}
	dataT[dataT.length-1].push(graph_data[graph_data.length-1][0]);
	iD=0;
	var flag = true;
	for (iC=0; iC<cutT.length; iC++){
		flag = true;
		while (flag){
			if ((dataT[iD][0]==cutT[iC])||(dataT[iD][1]==cutT[iC])){
				flag=false;
			} else if ((dataT[iD][0]<cutT[iC])&&(dataT[iD][1]>cutT[iC])){
				flag=false;
				dataT.splice(iD,0,dataT[iD].slice());
				dataT[iD][1]=cutT[iC];
				dataT[iD+1][0]=cutT[iC];
				iD++;
			} else {
				iD++;
			}
		}
	}
	for (iD=0; iD<dataT.length; iD++) {
		//may happen at 0 and at end
		if (dataT[iD][0]==dataT[iD][1]){
			dataT.splice(iD,1);
			iD--;
		}
	}
	//Delete subintervals that have been modified
	for (var iP=0; iP<prevdataT.length; iP++){
		//find difference between prevdataT and dataT
		flag=true;
		for (iD=0; iD<dataT.length; iD++) {
			if ((dataT[iD][0]==prevdataT[iP][0])&&(dataT[iD][1]==prevdataT[iP][1])){
				flag = false;
				break;
			}
		}
		if (flag){
			$.ajax({
				url: '{{=URL("store_subint_option.json")}}',
				data: {flise_record_id:cur_id, interval_time:prevdataT[iP][0]+':'+prevdataT[iP][1]},
				traditional: true,
				success: function(data){
					if (!(Object.getOwnPropertyNames(data).length === 0)){
						//remove it
						$.ajax({
							url: '{{=URL("del_subint.json")}}',
							data: {flise_record_id:data['flise_file_id'], interval_time:data['extract_time']},
							traditional: true
						});
					}
				}
			});
		}
	}		
	
	g.updateOptions({
		file: graph_data, 
		underlayCallback: function(canvas, area, g) {
			var area = g.layout_.getPlotArea();
			var altColor = false;
			canvas.clearRect(area.x, area.y, area.w, area.h);
			//Draw drop intervals
			for (iD=0; iD<dropT.length; iD++) {
				drawInterval (g, canvas, dropT[iD][0], dropT[iD][1], [255,128,128]);
			}
			//Draw nocut intervals
			for (iN=0; iN<nocutT.length; iN++) {
				drawInterval (g, canvas, nocutT[iN][0], nocutT[iN][1], [128,255,128]);
			}
			//Draw cut lines
			for (iC=0; iC<cutT.length; iC++) {
				drawVerticalLine(g, canvas, cutT[iC], "#7fbf7f")
			}
			//Draw data zones
			if (dataT.length>1){
				for (iD=0; iD<dataT.length; iD++) {
					if (altColor){
						drawDataZone (g, canvas, dataT[iD][0], dataT[iD][1], [128,128,255]);
						altColor = false;
					} else {
						drawDataZone (g, canvas, dataT[iD][0], dataT[iD][1], [51,204,255]);
						altColor = true;
					}
				}
			}
		}
	});
	//save dropT, cutT, nocutT to db.flise_file
	get_set_flisefile_option(cur_id, 'cutT');
	get_set_flisefile_option(cur_id, 'nocutT');
	get_set_flisefile_option(cur_id, 'dropT');
}

function add2nocut(startX, endX) {
	save2undo();
	//Check order
	if (endX<startX){
		var x = startX;
		startX = endX;
		endX = x;
	} else if (startX==endX) {
		return;
	}
	//If array is empty, initialize
	if (nocutT.length==0){
		nocutT.push([startX, endX]);
	} else {
		//Test if [s,e] overlaps with any already existing nocutT interval, in which case it joins them.
		var insertT = false;
		for (i=0; i<nocutT.length; i++) {
			if ((endX<=nocutT[i][1])&&(startX>=nocutT[i][0])){
				return;
			} else {
				if ((endX>nocutT[i][0])&&(startX<nocutT[i][0])){
					insertT = true;
					nocutT[i][0]=startX;
				}
				if ((endX>nocutT[i][1])&&(startX<nocutT[i][1])){
					insertT = true;
					nocutT[i][1]=endX;
				}
			}
		}
		//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
		//otherwise, add the new segment at correct position so that it is sorted in increasing order.
		if (insertT){
			var countHowMany = 0;
			var index = 0;
			for (i=1; i<nocutT.length; i++) {
				if (nocutT[i-1][1]>=nocutT[i][0]){
					countHowMany++;
					if (index==0){
						index=i;
					}
					nocutT[index-1][1]=nocutT[i][1];
				} else if (index!=0) {
					i=i-countHowMany;
					nocutT.splice(index, countHowMany);
					index = 0;
					countHowMany = 0;
				}
				if ((index!=0)&&(i==nocutT.length-1)){
					nocutT.splice(index, countHowMany);
				}
			}
		} else {
			var flag = true;
			if (endX<nocutT[0][0]){
				nocutT.splice(0,0,[startX, endX]);
				flag = false;
			} else {
				for (i=1; i<nocutT.length; i++) {
					if ((endX<nocutT[i][0])&&(startX>nocutT[i-1][1])){
						nocutT.splice(i,0,[startX, endX]);
						flag = false;
						break
					}
				}	
			}
			if (flag){
				nocutT.push([startX, endX]);
			}
		}
	}
	unifyT();
}

function add2drop(startX, endX) {
	save2undo();
	//Check order
	if (endX<startX){
		var x = startX;
		startX = endX;
		endX = x;
	} else if (startX==endX) {
		return;
	}
	//If array is empty, initialize
	if (dropT.length==0){
		dropT.push([startX, endX]);
	} else {
		//Test if [s,e] overlaps with any already existing dropT interval, in which case it joins them.
		var insertT = false;
		for (i=0; i<dropT.length; i++) {
			if ((endX<=dropT[i][1])&&(startX>=dropT[i][0])){
				return;
			} else {
				if ((endX>dropT[i][0])&&(startX<dropT[i][0])){
					insertT = true;
					dropT[i][0]=startX;
				}
				if ((endX>dropT[i][1])&&(startX<dropT[i][1])){
					insertT = true;
					dropT[i][1]=endX;
				}
			}
		}
		//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
		//otherwise, add the new segment at correct position so that it is sorted in increasing order.
		if (insertT){
			var countHowMany = 0;
			var index = 0;
			for (i=1; i<dropT.length; i++) {
				if (dropT[i-1][1]>=dropT[i][0]){
					countHowMany++;
					if (index==0){
						index=i;
					}
					dropT[index-1][1]=dropT[i][1];
				} else if (index!=0) {
					i=i-countHowMany;
					dropT.splice(index, countHowMany);
					index = 0;
					countHowMany = 0;
				}
				if ((index!=0)&&(i==dropT.length-1)) {
					dropT.splice(index, countHowMany);
				}
			}
		} else {
			var flag = true;
			if (endX<dropT[0][0]){
				dropT.splice(0,0,[startX, endX]);
				flag = false;
			} else {
				for (i=1; i<dropT.length; i++) {
					if ((endX<dropT[i][0])&&(startX>dropT[i-1][1])){
						dropT.splice(i,0,[startX, endX]);
						flag = false;
						break;
					}
				}	
			}
			if (flag){
				dropT.push([startX, endX]);
			}
		}
	}
	unifyT();
}

function erase(startX, endX) {
	save2undo();
	//Check order
	if (endX<startX){
		var x = startX;
		startX = endX;
		endX = x;
	} else if (startX==endX) {
		return;
	}
	//Erase
	for (var iD=0; iD<dropT.length; iD++) {
		if ((startX<=dropT[iD][0])&&(endX>=dropT[iD][1])){
			dropT.splice(iD,1);
			iD--;
		}
	}
	for (var iC=0; iC<cutT.length; iC++) {
		if ((cutT[iC]>=startX)&&(cutT[iC]<=endX)){
			cutT.splice(iC,1);
			iC--;
		}
	}
	for (var iN=0; iN<nocutT.length; iN++) {
		if ((startX<=nocutT[iN][0])&&(endX>=nocutT[iN][1])){
			nocutT.splice(iN,1);
			iN--;
		}
	}
	for (var iE=0; iE<eventT.length; iE++) {
		if ((eventT[iE]>=startX)&&(eventT[iE]<=endX)){
			//remove from db
			for (var iS=-1;iS<graph_data[0].length-1;iS++){
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:eventT[iE], series_id:iS},
					traditional: true,
					success: function(data){
						if (!(Object.getOwnPropertyNames(data).length === 0)){
							//remove it
							$.ajax({
								url: '{{=URL("del_event.json")}}',
								data: {flise_record_id:data['flise_file_id'], time:data['time'], series_id:data['series_id']},
								traditional: true
							});
						}
					}
				});
			}
			//remove from g
			var anns = g.annotations();
			for (var iA=0;iA<anns.length;iA++){
				if (anns[iA].xval==eventT[iE]){
					anns.splice(iA,1);
					iA--;
				}
			}
			g.setAnnotations(anns);
			//remove from eventT
			eventT.splice(iE,1);
			iE--;
		}
	}
	unifyT();
	//save eventT to db.flise_file
	get_set_flisefile_option(cur_id, 'eventT');
}

function add2cut(X) {
	save2undo();
	//If array is empty, initialize
	if (cutT.length==0){
		cutT.push(X);
	} else {
		//Check if it already exists
		for (i=0; i<cutT.length; i++) {
			if (cutT[i]==X){
				return;
			}
		}
		//Otherwise insert it while preserving the increasing order
		var flag = true;
		if (X<cutT[0]){
			cutT.splice(0,0,X);
			flag = false;
		} else {
			for (i=1; i<cutT.length; i++) {
				if ((X>cutT[i-1])&&(X<cutT[i])){
					cutT.splice(i,0,X);
					flag = false;
					break;
				}
			}
		}
		if (flag){
			cutT.push(X);
		}
	}
	unifyT();
}

function add2event(context,g){
	var p
	var distance
	var selectedPoint = null;
	// Find out if the click occurs on a point.
	var closestIdx = -1;
	var closestDistance = Number.MAX_VALUE;
	// check if the click was on a particular point.
	for (var i = 0; i < g.selPoints_.length; i++) {
		p = g.selPoints_[i];
		distance = Math.pow(p.canvasx - context.dragStartX, 2) + Math.pow(p.canvasy - context.dragStartY, 2);
		if (!isNaN(distance) && (closestIdx == -1 || distance < closestDistance)) {
			closestDistance = distance;
			closestIdx = i;
		}
	}
	// Allow any click within two pixels of the dot.
	var radius = g.attr_('highlightCircleSize') + 2;
	if (closestDistance <= radius * radius) {
		selectedPoint = g.selPoints_[closestIdx];
	}
	
	var time = g.selPoints_[closestIdx].xval;
	var series_id = -1;
	var series_name = 'all';
	var volume = '';
	var concentration = '';
	var comment = '';
	var type = 'comment';
	if (selectedPoint) {
		series_id = closestIdx;
		series_name = selectedPoint.name;
	}
	
	$.ajax({
		url: '{{=URL("store_event.json")}}',
		data: {flise_record_id:cur_id, time:time, series_id:series_id},
		traditional: true,
		success: function(data){
			if (Object.getOwnPropertyNames(data).length === 0){
				//create it
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'type', val: type},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'series_name', val: series_name},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'volume', val: volume},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'concentration', val: concentration},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_event.json")}}',
					data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'comment', val: comment},
					traditional: true
				});
				//and add it to the eventT (eventT behaves as a list to remember locally where the event are, even if the events/annotations are stored in db, and in the graph indirectly as well.): so, it is redendant (bad baaaad!), but conveniant (to be managed as cutT for instance).
				//save2undo(); //for the moment we don't undo event addition
				//If array is empty, initialize
				if (eventT.length==0){
					eventT.push(time);
				} else {
					var flag_exist = true;
					//Check if it already exists
					for (i=0; i<eventT.length; i++) {
						if (eventT[i]==time){
							flag_exist = false;
						}
					}
					//Otherwise insert it while preserving the increasing order
					if (flag_exist){
						var flag = true;
						if (time<eventT[0]){
							eventT.splice(0,0,time);
							flag = false;
						} else {
							for (i=1; i<eventT.length; i++) {
								if ((time>eventT[i-1])&&(time<eventT[i])){
									eventT.splice(i,0,time);
									flag = false;
									break;
								}
							}
						}
						if (flag){
							eventT.push(time);
						}
					}
				}
				//save eventT db.flise_file
				get_set_flisefile_option(cur_id, 'eventT');
				//and display event marker (or them if it concerns all series)
				var anns = g.annotations();
				if (series_id==-1){
					for (var i = 0; i < g.selPoints_.length; i++) {
						if (!(g.selPoints_[i].annotation)){
							anns.push({
								series: g.selPoints_[i].name,
								xval: time,
								icon: '/flise/static/icons/mark-event.png',
								width: 16,
								height: 16,
								tickHeight: 2,
								text: type
							});
						}
					}
				} else {
					if (!(selectedPoint.annotation)){
						var ann = {
							series: series_name,
							xval: time,
							icon: '/flise/static/icons/mark-event.png',
							width: 16,
							height: 16,
							tickHeight: 2,
							text: type
						};
						anns.push(ann);
					}
				}
				g.setAnnotations(anns);
			} else {
				//load values
				type = data['type'];
				series_name = data['series_name'];
				volume = data['volume'];
				concentration = data['concentration'];
				comment = data['comment'];
			}
			//Create corresponding panel
			$.get('{{=URL(request.application, 'static/templates','event.html')}}', function(htmlstr) {
				//Reset the panel
				$('#event').html('');
				//Adapt panel HTML
				var st = htmlstr;
				var stopt;
				if (series_id == -1){
					stopt='<option value="wash">wash</option> <option value="injection">injection</option>';
				} else {
					stopt='<option value="calibration">calibration</option>';
				}
				st = st.replace(/%time%/,time);
				st = st.replace(/%series_name%/,series_name);
				st = st.replace(/%volume%/, volume)
				st = st.replace(/%concentration%/, concentration);
				st = st.replace(/%comment%/, comment);
				st = st.replace(/%options%/, stopt);
				$('#event').append(st);
				
				//Select
				$('#event_type > option[value='+type+']').attr('selected','selected');
				$('#event_type').unbind('change');
				$('#event_type').change(function(){
					//Save type
					$.ajax({
						url: '{{=URL("store_event.json")}}',
						data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'type', val: $(this).val()},
						traditional: true
					});
					//Update hidden fields
					$('input[name="event_volume"]').parent().parent().show();
					$('input[name="event_concentration"]').parent().parent().show();
					switch($(this).val())
					{
					case 'comment':
					  $('input[name="event_volume"]').parent().parent().hide();
					  $('input[name="event_concentration"]').parent().parent().hide();
					  break;
					case 'wash':
					  $('input[name="event_concentration"]').parent().parent().hide();
					  break;
					case 'calibration':
					  $('input[name="event_volume"]').parent().parent().hide();
					  break;
					default:
					  break;
					}
				});
				//Volume reference input
				$('input[name="event_volume"]').unbind('change');
				$('input[name="event_volume"]').change(function(){
					//Save volume
					$.ajax({
						url: '{{=URL("store_event.json")}}',
						data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'volume', val: $(this).val()},
						traditional: true
					});
				});
				//Concentration reference input
				$('input[name="event_concentration"]').unbind('change');
				$('input[name="event_concentration"]').change(function(){
					//Save concentration
					$.ajax({
						url: '{{=URL("store_event.json")}}',
						data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'concentration', val: $(this).val()},
						traditional: true
					});
				});
				//Comment free text area
				$('textarea[name="event_comment"]').unbind('change');
				$('textarea[name="event_comment"]').change(function(){
					//Save comment
					$.ajax({
						url: '{{=URL("store_event.json")}}',
						data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'comment', val: $(this).val()},
						traditional: true
					});
				});
				
				//Show options
				modal = $("#event").modal({
					overlayClose:true,
					opacity:20,
				});
				
				//Hide fields according to type
				switch(type)
				{
				case 'comment':
				  $('input[name="event_volume"]').parent().parent().hide();
				  $('input[name="event_concentration"]').parent().parent().hide();
				  break;
				case 'wash':
				  $('input[name="event_concentration"]').parent().parent().hide();
				  break;
				case 'calibration':
				  $('input[name="event_volume"]').parent().parent().hide();
				  break;
				default:
				  break;
				}
			});
		}
	});
}

function createGraph(graph_data, labels){
	if (g==undefined){
		g = new Dygraph(document.getElementById("graphdiv"), graph_data,
			{
				labels: labels,
				width: window.innerWidth-530,
				height: window.innerHeight-90,
				labelsDiv: "labelsdiv",
				interactionModel: {
					mousedown: function (event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.mousedown(event, g, context);
						} else {
							context.initializeMouseDown(event, g, context);
							if (tool == 'nocut' || tool == 'drop'  || tool == 'cancel') {
								isSelecting = true; 
							} else {
								if (tool =='cut'){
									add2cut(getX(context.dragStartX, g));
								} else {
									if (tool=='event'){
										add2event(context, g);
									} else {
										interval2export(getX(context.dragStartX, g));
									}
								}
							}
						}
					},
					mousemove: function (event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.mousemove(event, g, context);
						} else {
							if (!isSelecting) return;
							drawSelectRect(event, g, context);
						}
					},
					mouseup: function(event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.mouseup(event, g, context);
						} else if (tool == 'nocut' || tool == 'drop'  || tool == 'cancel') {			
							eraseSelectRect(g, context);
							if (tool == 'nocut'){
								if (context.prevEndX != null){
									add2nocut(getX(context.dragStartX,g),getX(context.dragEndX,g));
								}
							} else if (tool == 'drop'){
								if (context.prevEndX != null){
									add2drop(getX(context.dragStartX,g),getX(context.dragEndX,g));
								}
							}	else if (tool == 'cancel'){
								if (context.prevEndX != null){
									erase(getX(context.dragStartX,g),getX(context.dragEndX,g));
								}
							}
						}
						context.dragStartX = null;
						context.dragStartY = null;
						context.prevEndX = null;
						context.prevEndY = null;
						finishSelect();
					},
					mouseout: function(event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.mouseout(event, g, context);
						}
					},
					dblclick: function(event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.dblclick(event, g, context);
						}
					},
					mousewheel: function(event, g, context) {
						var normal = event.detail ? event.detail * -1 : event.wheelDelta / 40;
						var percentage = normal / 50;
						var axis = g.xAxisRange();
						var xOffset = g.toDomCoords(axis[0], null)[0];
						var x = event.offsetX - xOffset;
						var w = g.toDomCoords(axis[1], null)[0] - xOffset;
						var xPct = w == 0 ? 0 : (x / w);
				
						var delta = axis[1] - axis[0];
						var increment = delta * percentage;
						var foo = [increment * xPct, increment * (1 - xPct)];
						var dateWindow = [ axis[0] + foo[0], axis[1] - foo[1] ];
				
						g.updateOptions({
							dateWindow: dateWindow
						});
						Dygraph.cancelEvent(event);
					}
				},
				strokeWidth: 0.5,
				gridLineColor: 'rgb(196, 196, 196)',
				logscale : false,
				axes:{
					x:{
						valueFormatter: function(t){
							var Tsamp=(graph_data[1][0]-graph_data[0][0]);
							return t+' ('+graph_time[Math.floor(t/Tsamp)]+')'
						}
					}
				},
				drawCallback: function(me, is_initial){
					if (is_initial){return;}
					var range = me.xAxisRange();
					if ((g2 != undefined)&&(!isDrawing)){
						isDrawing=true;
						var range = me.xAxisRange();
						g2.updateOptions( {
						  dateWindow: range
						} );
						isDrawing=false;
					}
				}
			});
	}
}

window.onmouseup = finishSelect;

/************* SELECTION TOOLS *********************/

function change_tool(tool_div) {
	var ids = ['tool_zoom', 'tool_cut', 'tool_nocut', 'tool_drop', 'tool_event', 'tool_cancel', 'tool_export'];
	for (var i = 0; i < ids.length; i++) {
		var div = document.getElementById(ids[i]);
		if (div == tool_div) {
			div.style.backgroundPosition = -(i * 32) + 'px -32px';
		} else {
			div.style.backgroundPosition = -(i * 32) + 'px 0px';
		}
	}
	tool = tool_div.id.replace('tool_', '');
	
	var dg_div = document.getElementById("graphdiv");
	if (tool == 'cut') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-cut.png) 1 30, auto';
	} else if (tool == 'nocut') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-nocut.png) 1 30, auto';
	} else if (tool == 'drop') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-drop.png) 1 30, auto';
	} else if (tool == 'event') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-event.png) 1 30, auto';
	} else if (tool == 'cancel') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-cancel.png) 1 30, auto';
	} else if (tool == 'export') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-export.png) 1 30, auto';
	} else if (tool == 'zoom') {
		dg_div.style.cursor = 'crosshair';
	}
}

/* -----------------------------END JSCRIPT------------------------------- */
