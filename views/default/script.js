/************ GLOBAL VAR ******************/
var graph_data = [];//Data to be displayed and processed
var graph_time = [];//Data for the original recorded time
var graph_labels;//Labels adapted
var g;//Graph variable (from dygraph)
var g2;//Graph variable for preprocessing result
var smooth_val;//Smoothing roller tool value (just for dygraph, not for preprocessing)
var cur_id;//ID of the Flise-file

//Global variables to save
var cutT;
var nodiffT;
var dropT;
var eventT;

//Global variables not to save
var prevcutT;
var prevnodiffT;
var prevdropT;
var preveventT;
var dataT;
var event_del;
var isSelecting;
var isDrawing=false;
var tool;

function aOa_cp_val(aOa){
	//copy an array of arrays (aOa) by value and return it: correct the fact that the array slice method still clones array of objects by reference
	var new_aOa = [];
	for (var i = 0; i < aOa.length; i++) {
		new_aOa.push(aOa[i].slice());
	}
	return new_aOa;
}

/************ Init **************/
$('#create_record').show();
$('.current_record').hide().prev().hide();
$('.local-help').hide();
$('#upload_flise').slideDown();

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

function init_files(){
	//Select a file (click behavior)
	$('.flise_file .flise_select').unbind('click');
	$('.flise_file .flise_select').click(function(){
		cur_id = $(this).parent().attr('id');
		initGraph(cur_id, $(this).html());
		//Load Raw Data Description Panel
		web2py_component('{{=URL('file')}}/' + cur_id, 'edit_record');
	});
	//Files Delete button
	$('.flise_del').unbind('click');
	$('.flise_del').unbind('confirm');
	$('.flise_del').click(function(){
		console.log('ok');
		$(this).parent().parent().remove();
		$.ajax({
			url:'{{=URL('file')}}',
			data: {delr: $(this).parent().parent().attr('id')}
		});
		if (cur_id == $(this).parent().parent().attr('id')){
			location.reload();
		}
	});
	$('.flise_del').confirm({
		stopAfter:'ok',
		wrapper: '<div style="width:130px;background-color: orange;" class="flise_del"></div>',
		timeout:3000
	});
}

/**************** WINDOW RESIZE *********************/
jQuery(document).ready(function(){
	 $(window).resize(function(){
		if (typeof g !== "undefined"){
		 	if (typeof g2 === "undefined")
				g.resize(window.innerWidth-530, window.innerHeight-90);
			else {
				g.resize(window.innerWidth-530, Math.floor((window.innerHeight-90)/2));
				g2.resize(window.innerWidth-530, Math.floor((window.innerHeight-90)/2));
			}
		}
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
		prevnodiffT = aOa_cp_val(nodiffT);
		prevdropT = aOa_cp_val(dropT);
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
		//Find position where all dataLocVar are above their threshold (index) or some are above the threshold (indexU)
		var index = new Array();
		var flag = true;
		for (var i = 0; i < dataLocVar.length; i++) {
			flag = true;
			for (var j = 0; j < dataLocVar[0].length; j++) {
				if (dataLocVar[i][j]<threshold[j]){
					flag = false;
					break;
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
				if (intDrop[j][0]>=intVar[i][0] && intDrop[j][1]<=intVar[i][1]){
					indInt.push(j);
				} else {
					if (indInt.length!=0){
						break
					}
				}
			}
			//Modify and remove unnecessary elements
			if (indInt.length>0){
				intDrop[indInt[0]][0]=intVar[i][0];
				intDrop[indInt[0]][1]=intVar[i][1];
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

		//Find the rest of the intervals where some dataLocVar are above their threshold (nodiff zone)
		var j0 = 0;
		for (var i = 0; i < intVar.length; i++) {
			for (var j = j0; j < intDrop.length; j++) {
				if (intDrop[j][1]<intVar[i][0]) {
					j0 = j; //this trick should increase the speed since intDrop and intVar are in "increasing" order.
				}
				if (intDrop[j][0]>=intVar[i][1]) {
					break;
				} else {
					if (intDrop[j][1] > intVar[i][0] && intDrop[j][0] < intVar[i][0]){
						intVar[i][0] = Math.min(intDrop[j][1], intVar[i][1]);
					}
					if (intDrop[j][1]>intVar[i][1] && intDrop[j][0] < intVar[i][1]){
						intVar[i][1] = Math.max(intDrop[j][0], intVar[i][0]);
					}
					if (intDrop[j][0] >= intVar[i][0] && intDrop[j][1] <= intVar[i][1]){
						if (intDrop[j][1] != intVar[i][1]) {
							intVar.splice(i+1, 0, [intDrop[j][1], intVar[i][1]]);
						} 
						intVar[i][1] = intDrop[j][0];
					}
					if (intVar[i][1] == intVar[i][0]){
						intVar.splice(i,1);
						i--;
						break;
					}
				} 
			}
		}
		//Cleaning up by removing intervals that are too small and shrinking the rest to take into account the windowing of size w
		var intVar0, intVar1;
		var flag0, flag1;
		j0 = 0;
		for (var i = 0; i < intVar.length; i++) {
			intVar0 = intVar[i][0];
			intVar1 = intVar[i][1];
			flag0 = true;
			flag1 = true;
			//Find if there is contact with intDropT
			for (var j = j0; j < intDrop.length; j++) {
				if (intDrop[j][1]<intVar0) {
					j0 = j; //this trick should increase the speed since intDrop and intVar are in "increasing" order.
				}
				if (intVar0 == intDrop[j][1]) {flag0 = false;};
				if (intVar1 == intDrop[j][0]) {flag1 = false;};
				if (intDrop[j][0]>intVar1) {
					break;
				}
			}
			if (flag0) {intVar0 = intVar0+step;};
			if (flag1) {intVar1 = intVar1-step;};
			if (intVar1 > intVar0){
				intVar[i][1] = intVar1;
				intVar[i][0] = intVar0;
			} else {
				intVar.splice(i,1);
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
		for (var i = 0; i < intVar.length; i++) {
			startX = intVar[i][0]*Tstep;
			endX = intVar[i][1]*Tstep;
			//If array is empty, initialize
			if (nodiffT.length==0){
				nodiffT.push([startX, endX])
			} else {
				//Test if [s,e] overlaps with any already existing nodiffT interval, in which case it joins them.
				insertT = false;
				flag = true;
				for (j=0; j<nodiffT.length; j++) {
					if ((endX<=nodiffT[j][1])&&(startX>=nodiffT[j][0])){
						flag = false;
						break;
					} else {
						if ((endX>nodiffT[j][0])&&(startX<nodiffT[j][0])){
							insertT = true;
							nodiffT[j][0]=startX;
						}
						if ((endX>nodiffT[j][1])&&(startX<nodiffT[j][1])){
							insertT = true;
							nodiffT[j][1]=endX;
						}
					}
				}
				//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
				//otherwise, add the new segment at correct position so that it is sorted in increasing order.
				if (flag){
					if (insertT){
						countHowMany = 0;
						indexI = 0;
						for (j=1; j<nodiffT.length; j++) {
							if (nodiffT[j-1][1]>=nodiffT[j][0]){
								countHowMany++;
								if (indexI==0){
									indexI=j;
								}
								nodiffT[indexI-1][1]=nodiffT[j][1];
							} else if (indexI!=0) {
								j=j-countHowMany;
								nodiffT.splice(indexI, countHowMany);
								indexI = 0;
								countHowMany = 0;
							}
							if ((indexI!=0)&&(i==nodiffT.length-1)) {
								nodiffT.splice(indexI, countHowMany);
							}
						}
					} else {
						flag = true;
						if (endX<nodiffT[0][0]){
							nodiffT.splice(0,0,[startX, endX]);
							flag = false;
						} else {
							for (j=1; j<nodiffT.length; j++) {
								if ((endX<nodiffT[j][0])&&(startX>nodiffT[j-1][1])){
									nodiffT.splice(j,0,[startX, endX]);
									flag = false;
									break;
								}
							}	
						}
						if (flag){
							nodiffT.push([startX, endX]);
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

	var Tsamp=(graph_data[1][0]-graph_data[0][0]);
	
	var strain_ref = $('select[name="select_strain_global"]').val();
	var comments = $('textarea[name="comments"]').val();
	var od = $('input[name="od"]').val();
	var dilutionf = $('input[name="dilutionf"]').val();
	var celldiameter = $('input[name="celldiameter"]').val();
	var name = $('input[name="created_on"]').val()+'('+graph_time[Math.floor(intStart/Tsamp)]+'-'+graph_time[Math.floor(intEnd/Tsamp)]+')_'+$('select[name="select_strain_global"] :selected').html();
	var calintercept = [];
	var calslope = [];
	$('input[name="calibration_slope"]').each(function(){
		calslope.push(($(this).val()=='') ? 'null' : $(this).val());
	});
	
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
				for (var i = $('#series_options > table').size()-1; i >= 0; i--) {
					calintercept.push('null');
					//calslope.push(undefined);
				}
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'intercept', val: calintercept},
					traditional: true
				});
				$.ajax({
					url: '{{=URL("store_subint_option.json")}}',
					data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'slope', val: calslope},
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
				calintercept = subintervals_data['intercept'];
				calslope = subintervals_data['slope'];
			}
			//Temp subinterval options and create corresponding panel
			$.get('{{=URL(request.application, 'static/templates','subinterval.html')}}', function(htmlstr) {
				function prepare_export(success_fkt, error_fkt){
					var flag_ok = true;
					if ($('input[name="sub_name"]').val() == '')  flag_ok = false;
					if ($('input[name="sub_od"]').val() == '') {flag_ok = false;};
					if ($('input[name="sub_dilutionf"]').val() == '') {flag_ok = false;};
					if ($('input[name="sub_celldiameter"]').val() == '') {flag_ok = false;};
					$('input[name="sub_calintercept"]').each(function(){
						if ($(this).val() == '') {flag_ok = false;};
					});
					$('input[name="sub_calslope"]').each(function(){
						if ($(this).val() == '') {flag_ok = false;};
					});
					if (flag_ok) {
						var raw_data = []; // extracted from original data
						var raw_time = []; // extracted from original time
						var raw_time_ref = []; // extracted from calculated time, used as reference since the original time is not reliable (not under the second)
						var raw_series = []; // reshaped timeseries to be passed for SG-differentiation
						for (var iS = graph_data[0].length - 2; iS >= 0; iS--) {
							raw_series.push([]);
						};
						var raw_data_point;
						for (var iP=0; iP<graph_data.length; iP++){
							if ((graph_data[iP][0]>=intStart) && (graph_data[iP][0]<=intEnd)){
								raw_data_point = graph_data.slice(iP,iP+1)[0];
								raw_data.push(raw_data_point.slice());
								raw_time.push(graph_time[iP]);
								raw_time_ref.push(raw_data_point[0]);
								for (var iS = 1; iS < raw_data_point.length; iS++) {
									raw_series[iS-1].push(raw_data_point[iS]);
								};
							}
						}
						//Split the subinterval into intervals to differentiate
						var diffT = [];
						var resInt = [intStart, intEnd];
						var sInt, lInt;
						for (var iN = 0; iN < nodiffT.length; iN++) {
							if (nodiffT[iN][0]>=intEnd) {break;} 
							else{
								sInt = nodiffT[iN].slice();
								lInt = resInt.slice();
								if (sInt[0]>=lInt[0] && sInt[1]<=lInt[1]) {
									if (sInt[0]!=lInt[0]) {diffT.push([lInt[0], sInt[0]]);};
									resInt = [sInt[1], lInt[1]];
								};
							};
						};
						if (resInt[0]!=resInt[1]) {
							diffT.push(resInt);
						};
						//1 Parameters
						var int_parameters = [
							['Name:', $('input[name="sub_name"]').val(), ' ', ' ', ' ', ' ', ' '],
							['Original raw file:', $('.current_record').text(), ' ', ' ', ' ', ' ', ' '],
							['Experiment start (raw):', intStart, raw_time[0], ' ', ' ', ' ', ' '],
							['Experiment end (raw):', intEnd, raw_time.slice(-1)[0], ' ', ' ', ' ', ' '],
							['Strain (reference):', $('#subinterval option:selected').html(), $('#subinterval select[name="sub_select_strain"]').val(), ' ', ' ', ' ', ' '],
							['Optical density:', $('input[name="sub_od"]').val(), ' ', ' ', ' ', ' ', ' '],
							['Dilution factor:', $('input[name="sub_dilutionf"]').val(), ' ', ' ', ' ', ' ', ' '],
							['Cell diameter:', $('input[name="sub_celldiameter"]').val(), ' ', ' ', ' ', ' ', ' '],
							['Surface to volume ratio:', ' ', ' ', ' ', ' ', ' ', ' '],
						];
						$('input[name="sub_calintercept"]').each(function(){
							int_parameters.push(['Series:', 'Name:', graph_labels[$(this).parent().parent().index()+1], 'Slope:', $(this).parent().parent().find('td').eq(1).find('input').first().val(), 'Intercept:', $(this).val()]);
						});
						int_parameters.push(['Comments:', $('textarea[name="sub_comments"]').val(), ' ', ' ', ' ', ' ', ' ']);
						int_parameters.push(['Savitzky-Golay window:',$('#lochw').val(), ' ', ' ', ' ', ' ', ' ']);
						int_parameters.push(['Savitzky-Golay order:',$('#order').val(), ' ', ' ', ' ', ' ', ' ']);
						//3 Processed data
						$.ajax({
							url: '{{=URL('subint_process_data.json')}}',
							data: {flise_file_id:cur_id, interval_time:intStart+':'+intEnd, data:JSON.stringify(raw_series), interval_diff:JSON.stringify(diffT)},
							traditional: true,
							async: false,
							type: 'POST',
							success: function(data){
								var concentrations = data.concentrations;
								var concentrationsSmooth = data.concentrationsSmooth;
								var concentrationsDiff = data.concentrationsDiff;
								var fluxes = data.fluxes;
								var volume = data.volume;
								var ncell = data.ncell;
								var surf2vol_ratio = data.surf2vol_ratio;
								int_parameters[8][1] = String(surf2vol_ratio);
								var intEvents = data.intEvents;
								var intSolutions = data.intSolutions;
								//Structure results into a table
								var result = [];
								var header_result = [];
								header_result.push('Time (s)');
								header_result.push('Measurement time (hh:mm:ss)');
								for (var iS = 0; iS < concentrations.length; iS++) {
									header_result.push('['+graph_labels[iS+1]+']cuv (mol/L)');
								};
								for (var iS = 0; iS < concentrationsSmooth.length; iS++) {
									header_result.push('['+graph_labels[iS+1]+']cuv_smoothed (mol/L)');
								};
								for (var iS = 0; iS < concentrationsDiff.length; iS++) {
									header_result.push('d/dt['+graph_labels[iS+1]+']cuv (mol/L/s)');
								};
								for (var iS = 0; iS < fluxes.length; iS++) {
									header_result.push('influx('+graph_labels[iS+1]+') (nmol/s/m^2)');
								};
								header_result.push('Cuvette volume (L)');
								header_result.push('Number of cells in cuvette');
								for (var iT = 0; iT < raw_time_ref.length; iT++) {
									result.push([raw_time_ref[iT], raw_time[iT]]);
									for (var iS = 0; iS < concentrations.length; iS++) {
										result[iT].push(concentrations[iS][iT]);
									};
									for (var iS = 0; iS < concentrationsSmooth.length; iS++) {
										result[iT].push(concentrationsSmooth[iS][iT]);
									};
									for (var iS = 0; iS < concentrationsDiff.length; iS++) {
										result[iT].push(concentrationsDiff[iS][iT]);
									};
									for (var iS = 0; iS < fluxes.length; iS++) {
										result[iT].push(fluxes[iS][iT]);
									};
									result[iT].push(volume[iT]);
									result[iT].push(ncell[iT]);
								};
								//Structure events and solutions into a table
								var events = [];
								var solutions = [];
								for (var iE = 0; iE < intEvents.length; iE++) {
									events.push([intEvents[iE].time, intEvents[iE].type, intEvents[iE].series_name, intEvents[iE].solution_name, (intEvents[iE].volume != null) ? intEvents[iE].volume : ' ', (intEvents[iE].concentration != null) ? intEvents[iE].concentration : ' ', intEvents[iE].comment]);
								};
								for (var iS = 0; iS < intSolutions.length; iS++) {
									for (var iC = 0; iC < intSolutions[iS].components_name.length; iC++) {
										solutions.push([(iC == 0) ? intSolutions[iS].name : ' ', intSolutions[iS].components_name[iC], intSolutions[iS].components_ratio[iC]]);
									};
								};
								//Make XLS
								var data = [['1 Parameters', { header:[], 
										data: int_parameters
									}],
									['2 Raw Data', { header:graph_labels, 
										data: raw_data
									}],
									['3 Processed Data', { header:header_result, 
										data: result
									}],
									['4 Events', { header:['Time', 'Type', 'Series name (or all)', 'Solution', 'Volume', 'Concentration', 'Comment'], 
										data: events
									}],
									['5 Solutions', { header:['Name', 'Component', 'Concentration ratio'], 
										data: solutions
									}]
								];
								success_fkt(data);
							}
						});
					} else {
						error_fkt();
					};
				};

				//Reset the panel
				$('#subinterval').html('');
				//Adapt panel HTML
				var st = htmlstr;
				st = st.replace(/%start%/,intStart);
				st = st.replace(/%end%/,intEnd);
				st = st.replace(/%name%/, name)
				st = st.replace(/%strain_ref%/, $('#strains_store > div').html());
				st = st.replace('select_strain_global', 'sub_select_strain');
				st = st.replace(/%comments%/, comments);
				st = st.replace(/%od%/, od);
				st = st.replace(/%dilutionf%/, dilutionf);
				st = st.replace(/%celldiameter%/, celldiameter);
				//Series - Calibration
				var stcal;
				for (var i = 0;i<$('#series_options > table').size();i++){
					stcal = '<tr><td style="color:%color%">%species%</td><td>Slope: <input name="sub_calslope" type="text" value="%slope%" style="width:60px" class="double"/></td><td>Intercept: <input name="sub_calintercept" type="text" value="%intercept%" style="width:60px" class="double"/>(Volt)</td></tr>';
					stcal = stcal.replace(/%species%/, $('#series'+i+' > tbody > tr > td > select').val());
					stcal = stcal.replace(/%color%/, $('#series'+i+' > tbody > tr:eq(1) > td > table > tbody > tr > td > input').val());
					if (calslope[i]==undefined || calslope[i]=='null') {
						stcal = stcal.replace(/%slope%/,'');
					} else {
						stcal = stcal.replace(/%slope%/,calslope[i]);
					}
					if (calintercept[i]==undefined || calintercept[i]=='null') {
						stcal = stcal.replace(/%intercept%/,'');
					} else {
						stcal = stcal.replace(/%intercept%/,calintercept[i]);
					}
					st = st.replace(/%caloptions%/,stcal+'%caloptions%');
				}
				st = st.replace(/%caloptions%/,'');
				$('#subinterval').append(st);
				$('#subinterval select[name="sub_select_strain"] option[value="'+strain_ref+'"]').attr('selected','selected');
				if (name == '') {
					$('input[name="sub_name"]').parent().parent().find('th').first().attr('style','color: red');
				};
				if (od == '') {
					$('input[name="sub_od"]').parent().parent().find('th').first().attr('style','color: red');
				};
				if (dilutionf == '') {
					$('input[name="sub_dilutionf"]').parent().parent().find('th').first().attr('style','color: red');
				};
				if (celldiameter == '') {
					$('input[name="sub_celldiameter"]').parent().parent().find('th').first().attr('style','color: red');
				};
				$('input[name="sub_calintercept"]').each(function(){
					if ($(this).val() == '') {$(this).parent().attr('style','color: red');};
				});
				$('input[name="sub_calslope"]').each(function(){
					if ($(this).val() == '') {$(this).parent().attr('style','color: red');};
				});
				//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx
				//pyMantis export
				$('#export2pyMantis').unbind('click');
				$('#export2pyMantis').click(function(){
						$('#export2excel').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
						prepare_export(
						function(data){
							$('#pymantis_export_form').html("<input type='hidden' value='"+JSON.stringify(data)+"' name='data'/> <input type='hidden' value='"+cur_id+"' name='flise_id'/> <input type='hidden' value='"+$('input[name="sub_name"]').val()+"' name='filename'/> ");
							$('#pymantis_export_form').submit();
							$('#export2pyMantis').removeAttr("disabled").removeAttr("style");
							window.open("http://translucent-network.org/pyMantis/tlc/edit/FLISElab", "_blank");
							// $.ajax({
							// 	url: '{{=URL(request.application, 'default', 'export_spreadsheet')}}',
							// 	type: 'POST',
							// 	data: {data: JSON.stringify(data), filename: 'bla.xls', format: 'store_xls'},
							// 	success: function(xlsfile){
							// 		$.ajax({
							// 			url:'{{=URL(request.application, 'default', 'export_file')}}',
							// 			data: {flise_id: cur_id},
							// 			success: function(zipfile){
							// 				$('#pymantis_export_form').html("<input type='hidden' value='"+data+"' name='data'/> <input type='hidden' value='"+zipfile+"'/>");
							// 				$('#pymantis_export_form').submit();
							// 				$('#export2pyMantis').removeAttr("disabled").removeAttr("style");
							// 			}
							// 		});
							// 		//$('#pymantis_export_form').html("<input type='text' value='"+data+"' name='data'/> ");
							// 	},
							// 	$('#export2pyMantis').removeAttr("disabled").removeAttr("style");
							//});
						},
						function(){
							$('#export2pyMantis').removeAttr("disabled").removeAttr("style");
						}
					);
				});
				//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx
				//spreadsheet export
				$('#export2excel').unbind('click')
				$('#export2excel').click(function(){
					prepare_export(
						function(data){
							$('#json2spreadsheet_form').html("<input type='hidden' value='"+JSON.stringify(data)+"' name='data'/> <input type='hidden' value='xls' name='format'/> <input type='hidden' value='"+$('input[name="sub_name"]').val()+"' name='filename'/> ");
							$('#json2spreadsheet_form').submit();
							$('#export2excel').removeAttr("disabled").removeAttr("style");
						},
						function(){
							$('#export2excel').removeAttr("disabled").removeAttr("style");				
						}
					);
				});	
				//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx
				
				//Name input
				$('input[name="sub_name"]').unbind('change');
				$('input[name="sub_name"]').change(function(){
					$(this).parent().parent().find('th').first().removeAttr('style');
					if ($(this).val() == '') {
						//Alert
						$(this).parent().parent().find('th').first().attr('style','color: red');
					} else {
						//Save subinterval name
						$.ajax({
							url: '{{=URL("store_subint_option.json")}}',
							data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'name', val: $(this).val()},
							traditional: true
						});
					};
				});
				//Strain reference input
				$('select[name="sub_select_strain"]').unbind('change');
				$('select[name="sub_select_strain"]').change(function(){
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
					$(this).parent().parent().find('th').first().removeAttr('style');
					if ($(this).val() == '') {
						//Alert
						$(this).parent().parent().find('th').first().attr('style','color: red');
					} else {
						//Save new OD
						$.ajax({
							url: '{{=URL("store_subint_option.json")}}',
							data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'optical_density', val: $(this).val()},
							traditional: true
						});
					}
				});
				//Dilution factor input
				$('input[name="sub_dilutionf"]').unbind('change');
				$('input[name="sub_dilutionf"]').change(function(){
					$(this).parent().parent().find('th').first().removeAttr('style');
					if ($(this).val() == '') {
						//Alert
						$(this).parent().parent().find('th').first().attr('style','color: red');
					} else {
						//Save new dilution factor
						$.ajax({
							url: '{{=URL("store_subint_option.json")}}',
							data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'dilution_factor', val: $(this).val()},
							traditional: true
						});
					}
				});
				//Cell diameter input
				$('input[name="sub_celldiameter"]').unbind('change');
				$('input[name="sub_celldiameter"]').change(function(){
					$(this).parent().parent().find('th').first().removeAttr('style');
					if ($(this).val() == '') {
						//Alert
						$(this).parent().parent().find('th').first().attr('style','color: red');
					} else {
						//Save new cell diameter
						$.ajax({
							url: '{{=URL("store_subint_option.json")}}',
							data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'cell_diameter', val: $(this).val()},
							traditional: true
						});
					}
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
				$('input[name="sub_calintercept"]').change(function(){
					$(this).parent().removeAttr('style');
					if ($(this).val() == '') {
						$(this).parent().attr('style','color: red');
					} 
					var items = [];
					$('input[name="sub_calintercept"]').each(function(){
						items.push(($(this).val()=='')?'null':$(this).val());
					});
					//Save intercept change
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'intercept', val: items},
						traditional: true
					});
				});
				$('input[name="sub_calslope"]').change(function(){
					$(this).parent().removeAttr('style');
					if ($(this).val() == '') {
						$(this).parent().attr('style','color: red');
					}
					var items = [];
					$('input[name="sub_calslope"]').each(function(){
						items.push(($(this).val()=='')?'null':$(this).val()); 
					});
					//Save slope change
					$.ajax({
						url: '{{=URL("store_subint_option.json")}}',
						data: {flise_record_id:cur_id, interval_time:intStart+':'+intEnd, var_name:'slope', val: items},
						traditional: true
					});
				});
				//Make popup
				event_modal = $("#subinterval").modal({
					overlayClose:true,
					opacity:20,
					onOpen: function (dialog) {
						dialog.overlay.fadeIn(100, function () {
							dialog.container.fadeIn(5, function () {
								dialog.data.fadeIn('fast');
							});
						});
					},
				    onShow: function (dialog) {
				        dialog.container.css("height", "auto");
				    },
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
	
	if (tool == 'nodiff'){
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
	prevnodiffT = aOa_cp_val(nodiffT);
	prevdropT = aOa_cp_val(dropT);
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

function dataZones() {
	//Data zones are intervals between drop zones and cuts.
	var dataT = [];
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
	return dataT;
}
function unifyT() {
	//Drop tool defines intervals to ignore (data to trash), therefore it has priority (one cannot insert a cut point or a nodiff interval in a drop zone)
	for (var iD=0; iD<dropT.length; iD++) {
		for (var iC=0; iC<cutT.length; iC++) {
			if (cutT[iC]>dropT[iD][1]){break}
			if ((cutT[iC]>=dropT[iD][0])&&(cutT[iC]<=dropT[iD][1])){
				cutT.splice(iC,1);
				iC--;
			}
		}
		for (var iN=0; iN<nodiffT.length; iN++) {
			if (nodiffT[iN][0]>dropT[iD][1]){break}
			if ((nodiffT[iN][0]>=dropT[iD][0])&&(nodiffT[iN][1]<=dropT[iD][1])){
				nodiffT.splice(iN,1);
				iN--;
			} else if ((nodiffT[iN][0]<dropT[iD][0])&&(nodiffT[iN][1]>dropT[iD][0])){
				if(nodiffT[iN][1]>dropT[iD][1]){
					nodiffT.splice(iN, 1, [nodiffT[iN][0], dropT[iD][0]], [dropT[iD][1], nodiffT[iN][1]]);
				} else {
					nodiffT[iN][1]=dropT[iD][0];
				}
			} else if ((nodiffT[iN][0]<dropT[iD][1])&&(nodiffT[iN][1]>dropT[iD][1])){
				//here we should have (nodiffT[iN][0]>dropT[iD][0]) only
				nodiffT[iN][0]=dropT[iD][1];
			}
		}
	}
	//Cut has priority over nodiff interval.
	for (iC=0; iC<cutT.length; iC++) {
		for (iN=0; iN<nodiffT.length; iN++) {
			if ((nodiffT[iN][0]<cutT[iC])&&(nodiffT[iN][1]>cutT[iC])){
				nodiffT.splice(iN, 0, [nodiffT[iN][0], cutT[iC]]);
				nodiffT[iN+1][0]=cutT[iC];
			}
		}
	}
	//Calculate data zones
	var prevdataT = dataT;
	dataT = dataZones();
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
		underlayCallback: function(canvas, area, g) {
			var area = g.layout_.getPlotArea();
			var altColor = false;
			canvas.clearRect(area.x, area.y, area.w, area.h);
			//Draw drop intervals
			for (iD=0; iD<dropT.length; iD++) {
				drawInterval (g, canvas, dropT[iD][0], dropT[iD][1], [255,128,128]);
			}
			//Draw nodiff intervals
			for (iN=0; iN<nodiffT.length; iN++) {
				drawInterval (g, canvas, nodiffT[iN][0], nodiffT[iN][1], [128,255,128]);
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
	//save dropT, cutT, nodiffT to db.flise_file
	get_set_flisefile_option(cur_id, 'cutT');
	get_set_flisefile_option(cur_id, 'nodiffT');
	get_set_flisefile_option(cur_id, 'dropT');
}

function add2nodiff(startX, endX) {
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
	if (nodiffT.length==0){
		nodiffT.push([startX, endX]);
	} else {
		//Test if [s,e] overlaps with any already existing nodiffT interval, in which case it joins them.
		var insertT = false;
		for (i=0; i<nodiffT.length; i++) {
			if ((endX<=nodiffT[i][1])&&(startX>=nodiffT[i][0])){
				return;
			} else {
				if ((endX>nodiffT[i][0])&&(startX<nodiffT[i][0])){
					insertT = true;
					nodiffT[i][0]=startX;
				}
				if ((endX>nodiffT[i][1])&&(startX<nodiffT[i][1])){
					insertT = true;
					nodiffT[i][1]=endX;
				}
			}
		}
		//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
		//otherwise, add the new segment at correct position so that it is sorted in increasing order.
		if (insertT){
			var countHowMany = 0;
			var index = 0;
			for (i=1; i<nodiffT.length; i++) {
				if (nodiffT[i-1][1]>=nodiffT[i][0]){
					countHowMany++;
					if (index==0){
						index=i;
					}
					nodiffT[index-1][1]=nodiffT[i][1];
				} else if (index!=0) {
					i=i-countHowMany;
					nodiffT.splice(index, countHowMany);
					index = 0;
					countHowMany = 0;
				}
				if ((index!=0)&&(i==nodiffT.length-1)){
					nodiffT.splice(index, countHowMany);
				}
			}
		} else {
			var flag = true;
			if (endX<nodiffT[0][0]){
				nodiffT.splice(0,0,[startX, endX]);
				flag = false;
			} else {
				for (i=1; i<nodiffT.length; i++) {
					if ((endX<nodiffT[i][0])&&(startX>nodiffT[i-1][1])){
						nodiffT.splice(i,0,[startX, endX]);
						flag = false;
						break
					}
				}	
			}
			if (flag){
				nodiffT.push([startX, endX]);
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
	for (var iN=0; iN<nodiffT.length; iN++) {
		if ((startX<=nodiffT[iN][0])&&(endX>=nodiffT[iN][1])){
			nodiffT.splice(iN,1);
			iN--;
		}
	}
	event_del = [];
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
							//store for undo
							event_del.push(data);
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
	function solution_panel(htmlstr){
		//solution_panel() is used in add_event when creating or editing a solution
		// many variables are passed by closure from add2event()
		var stsol = htmlstr;
		stsol = stsol.replace(/%name%/,solution_name);
		var stcomp;
		for (var i = 0; i < solution_components.length; i++) {
			stcomp = '<tr><th align="left">Component '+String(i+1)+':</th><td style="text-align: left"> %component% </td> <td style="text-align: right"> Concentration ratio (from 0 to 1): <input class="component_ratio" type="text" style="width:40px" value="%ratio%"/></td> <td><input type="submit" value="remove" class="remove_component"/></td> </tr>    %stcomp%';
			stcomp = stcomp.replace(/%component%/, solution_components[i]);
			stcomp = stcomp.replace(/%ratio%/, solution_ratios[i]);
			stsol = stsol.replace(/%stcomp%/,stcomp);
		};
		stsol = stsol.replace(/%stcomp%/,'');
		stsol = stsol.replace(/%select_components%/, $('#components_store > div').html());
		//Reset the panel
		$('#solution').html('');
		//Adapt panel HTML
		$('#solution').append(stsol);
		$('#solution_warning').hide();
		$('#solution_delete_refused').hide();
		if (flag_unique) {$('#solution_exists').hide();};
		$('#solution_name_warning').hide();
		if (solution_id == null){
			$('#solution_duplicate').hide();
			$('#solution_delete').hide();
			$('input[name="solution_name"]').parent().parent().find('th').attr('style','color:red');
			$('#solution_name_warning').show();
		}
		//Change name
		$('input[name="solution_name"]').unbind('change');
		$('input[name="solution_name"]').change(function(){
			//Load other solution names and check it is not already used
			var flag_exist = false;
			for (var iS = $('select[name="select_solution"] option').size() - 1; iS >= 0; iS--) {
				if ($(this).val() == $('select[name="select_solution"] option').eq(iS).text()) {
					if (!(solution_id == null)) {
						if (!(solution_id == $('select[name="select_solution"] option').eq(iS).val())) {
							flag_exist = true;
							break;
						};
					} else {
						flag_exist = true;
						break;
					};
				};
			};
			$('input[name="solution_name"]').parent().parent().find('th').removeAttr('style');
			$('#solution_name_warning').hide();
			if (flag_exist) {
				$('input[name="solution_name"]').parent().parent().find('th').attr('style','color:red');
				$('#solution_name_warning').show();
			};
			//Save name
			solution_name = $(this).val();
		});
		//Add component from list
		$('select[name="select_components"]').unbind('change');
		$('select[name="select_components"]').change(function(){
			//Check it is not already a component or empty
			var flag_exist = false;
			if ($(this).val() == '') {
				flag_exist = true;
			} else {
				for (var iC = solution_components.length - 1; iC >= 0; iC--) {
					if (solution_components[iC] == $(this).val()) {
						flag_exist = true;
						break;
					};
				};
			};
			
			if (!(flag_exist)) {
				//Save new component
				solution_components.push($(this).val());
				solution_ratios.push('1');
				//Change panel
				var i = solution_components.length - 1;
				var stcomp = '<tr><th align="left">Component '+String(i+1)+':</th><td style="text-align: left"> %component% </td> <td style="text-align: right"> Concentration ratio (from 0 to 1): <input class="component_ratio" type="text" style="width:40px" value="%ratio%"/></td> <td><input type="submit" value="remove" class="remove_component"/></td> </tr>';
				stcomp = stcomp.replace(/%component%/, solution_components[i]);
				stcomp = stcomp.replace(/%ratio%/, solution_ratios[i]);
				$('#new_component').parent().parent().before(stcomp);
				//Set component concentration ratio (refresh)
				$('.component_ratio').unbind('change');
				$('.component_ratio').change(function(){
					//Collect component to change
					var update_ratio = $(this).val();
					var update_component = $(this).parent().parent().find('td').eq(0).text().trim();
					var update_index;
					for (var iC = solution_components.length - 1; iC >= 0; iC--) {
						if (solution_components[iC] == update_component) {
							solution_ratios.splice(iC,1,update_ratio);
							update_index = iC;
							break;
						};
					};
					$(this).parent().attr('style','text-align: right');
					if (isNaN(parseFloat(update_ratio))){
						$(this).parent().attr('style','text-align: right; color:red');
					} else {
						if ((parseFloat(update_ratio) >= 0) && (parseFloat(update_ratio) <= 1)) {
							update_ratio = String(parseFloat(update_ratio));
							$(this).val(update_ratio);
							solution_ratios.splice(update_index,1,update_ratio);
						} else {
							$(this).parent().attr('style','text-align: right; color:red');
						};
					}
				});
				//Remove component (refresh)
				$('.remove_component').unbind('click');
				$('.remove_component').click(function(){
					//Collect component to remove
					var rm_component = $(this).parent().parent().find('td').eq(0).text().trim();
					//Remove it
					for (var iC = solution_components.length - 1; iC >= 0; iC--) {
						if (solution_components[iC] == rm_component) {
							solution_components.splice(iC,1);
							solution_ratios.splice(iC,1);
							break;
						};
					};
					$(this).parent().parent().remove();
					//Refresh listing
					for (var iC = solution_components.length; iC > 0; iC--) {
						$('#add_component').parent().parent().parent().find('tr').eq(iC).find('th').html('Component '+String(iC)+':');
					}
				});
			};
		});
		//Add new component
		$('#add_component').unbind('click');
		$('#add_component').click(function(){
			//Check it is not already a component or empty
			var flag_exist = false;
			if ($('#new_component').val() == '') {
				flag_exist = true;
			} else {
				for (var iC = solution_components.length - 1; iC >= 0; iC--) {
					if (solution_components[iC] == $('#new_component').val()) {
						flag_exist = true;
						break;
					};
				};
			};
			
			if (!(flag_exist)) {
				//Save new component
				solution_components.push($('#new_component').val());
				solution_ratios.push('1');
				//Change panel
				var i = solution_components.length - 1;
				var stcomp = '<tr><th align="left">Component '+String(i+1)+':</th><td style="text-align: left"> %component% </td> <td style="text-align: right"> Concentration ratio (from 0 to 1): <input class="component_ratio" type="text" style="width:40px" value="%ratio%"/></td> <td><input type="submit" value="remove" class="remove_component"/></td> </tr>';
				stcomp = stcomp.replace(/%component%/, solution_components[i]);
				stcomp = stcomp.replace(/%ratio%/, solution_ratios[i]);
				$('#new_component').parent().parent().before(stcomp);
				//Set component concentration ratio (refresh)
				$('.component_ratio').unbind('change');
				$('.component_ratio').change(function(){
					//Collect component to change
					var update_ratio = $(this).val();
					var update_component = $(this).parent().parent().find('td').eq(0).text().trim();
					var update_index;
					for (var iC = solution_components.length - 1; iC >= 0; iC--) {
						if (solution_components[iC] == update_component) {
							solution_ratios.splice(iC,1,update_ratio);
							update_index = iC;
							break;
						};
					};
					$(this).parent().attr('style','text-align: right');
					if (isNaN(parseFloat(update_ratio))){
						$(this).parent().attr('style','text-align: right; color:red');
					} else {
						if ((parseFloat(update_ratio) >= 0) && (parseFloat(update_ratio) <= 1)) {
							update_ratio = String(parseFloat(update_ratio));
							$(this).val(update_ratio);
							solution_ratios.splice(update_index,1,update_ratio);
						} else {
							$(this).parent().attr('style','text-align: right; color:red');
						};
					}
				});
				//Remove component (refresh)
				$('.remove_component').unbind('click');
				$('.remove_component').click(function(){
					//Collect component to remove
					var rm_component = $(this).parent().parent().find('td').eq(0).text().trim();
					//Remove it
					for (var iC = solution_components.length - 1; iC >= 0; iC--) {
						if (solution_components[iC] == rm_component) {
							solution_components.splice(iC,1);
							solution_ratios.splice(iC,1);
							break;
						};
					};
					$(this).parent().parent().remove();
					//Refresh listing
					for (var iC = solution_components.length; iC > 0; iC--) {
						$('#add_component').parent().parent().parent().find('tr').eq(iC).find('th').html('Component '+String(iC)+':');
					}
				});
			};
		});
		//Set component concentration ratio
		$('.component_ratio').unbind('change');
		$('.component_ratio').change(function(){
			//Collect component to change
			var update_ratio = $(this).val();
			var update_component = $(this).parent().parent().find('td').eq(0).text().trim();
			var update_index;
			for (var iC = solution_components.length - 1; iC >= 0; iC--) {
				if (solution_components[iC] == update_component) {
					solution_ratios.splice(iC,1,update_ratio);
					update_index = iC;
					break;
				};
			};
			$(this).parent().attr('style','text-align: right');
			if (isNaN(parseFloat(update_ratio))){
				$(this).parent().attr('style','text-align: right; color:red');
			} else {
				if ((parseFloat(update_ratio) >= 0) && (parseFloat(update_ratio) <= 1)) {
					update_ratio = String(parseFloat(update_ratio));
					$(this).val(update_ratio);
					solution_ratios.splice(update_index,1,update_ratio);
				} else {
					$(this).parent().attr('style','text-align: right; color:red');
				};
			}
		});
		//Remove component
		$('.remove_component').unbind('click');
		$('.remove_component').click(function(){
			//Collect component to remove
			var rm_component = $(this).parent().parent().find('td').eq(0).text().trim();
			//Remove it
			for (var iC = solution_components.length - 1; iC >= 0; iC--) {
				if (solution_components[iC] == rm_component) {
					solution_components.splice(iC,1);
					solution_ratios.splice(iC,1);
					break;
				};
			};
			$(this).parent().parent().remove();
			//Refresh listing
			for (var iC = solution_components.length; iC > 0; iC--) {
				$('#add_component').parent().parent().parent().find('tr').eq(iC).find('th').html('Component '+String(iC)+':');
			}
		});
		//Duplicate solution
		$('#solution_duplicate').unbind('click');
		$('#solution_duplicate').click(function(){
			//Detach from previous solution
			solution_id = null;
			$('#solution_duplicate').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
			$('#solution_delete').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
			$('select[name="event_select_solution"] option:selected').removeAttr('selected');
			//Create new name and update
			solution_name = $('input[name="solution_name"]').val()+' copy';
			$('input[name="solution_name"]').val(solution_name);
			//Load other solution names and check it is not already used
			var flag_exist = false;
			for (var iS = $('select[name="select_solution"] option').size() - 1; iS >= 0; iS--) {
				if (solution_name == $('select[name="select_solution"] option').eq(iS).text()) {
					flag_exist = true;
					break;
				};
			};
			$('input[name="solution_name"]').parent().parent().find('th').removeAttr('style');
			$('#solution_name_warning').hide();
			if (flag_exist) {
				$('input[name="solution_name"]').parent().parent().find('th').attr('style','color:red');
				$('#solution_name_warning').show();
			};
		});
		//Set delete function
		$('#solution_delete').unbind('click');
		$('#solution_delete').click(function(){
			$('#solution_delete_refused').hide();
			//Delete confirm
			$('#solution_delete').parent().parent().find('td').eq(0).find('span').html('<div style="color: orangeRed; font-size: smaller">Are you sure you want to delete this solution (current event erased)?</div>');
			$('#solution_delete').parent().parent().find('td').eq(1).find('span').html('<input type="submit" value="Yes" id="solution_delete_confirm"/> <input type="submit" value="No" id="solution_delete_cancel"/>');
			$('#solution_duplicate').hide();
			$('#solution_delete').hide();
			$('#solution_cancel').hide();
			$('#solution_done').hide();
			$('#solution_delete_cancel').unbind('click');
			$('#solution_delete_cancel').click(function(){
				$('#solution_delete').parent().parent().find('td').eq(0).find('span').html('');
				$('#solution_delete').parent().parent().find('td').eq(1).find('span').html('');
				$('#solution_delete').show();
				$('#solution_duplicate').show();
				$('#solution_cancel').show();
				$('#solution_done').show();
			});
			$('#solution_delete_confirm').unbind('click');
			$('#solution_delete_confirm').click(function(){
				//Erase from db.solution only if the current event is the last to use this solution, or if no event uses this solution
				$.ajax({
					url: '{{=URL("del_solution.json")}}',
					data: {solution_id:solution_id, flise_file_id:cur_id, series_id:series_id, time:time},
					traditional: true,
					success: function(data){
						if (data['acceptDel']) {
							//Close modal window
							$.modal.close();
							//Since current event might have been erased, we need to ensure it is not in the display, otherwise, by pressing 'Cancel' in the event panel, we may have trace of it in g.annotations and eventT
							var flag = true;
							var preserve_series_name = data['series_name'];
							if (data['series_name'].length == 1){
								if (data['series_name'][0] == 'all') {
									preserve_series_name = graph_labels;
								};
							}
							for (var iE=0; iE<eventT.length; iE++) {
								if (eventT[iE]==time){

									//remove from g
									var anns = g.annotations();
									for (var iA=0;iA<anns.length;iA++){
										if (anns[iA].xval==time){
											flag = true;
											//find if it is not a series on which one should preserve the marker
											for (var iS = 0; iS < preserve_series_name.length; iS++) {
											 	if (preserve_series_name[iS] == anns[iA].series){flag = false;}
											};
											if (flag) {
												//if the event solution is reprecised then event created, one should replace the g.annotation markers
												flag_add = true;
												for (var i = selectedPoints.length - 1; i >= 0; i--) {
													selectedPoints[i].annotation = false;
												};
												//delete
												anns.splice(iA,1);
												iA--;
											};
										}
									}
									g.setAnnotations(anns);
									//remove from eventT
									if (data['series_name'].length == 0) {
										eventT.splice(iE,1);
										//save eventT db.flise_file
										get_set_flisefile_option(cur_id, 'eventT');
									}
									break;
								}
							}
							//Come back to event modal and update it
							window.setTimeout(function() {
								event_modal = $("#event").modal({
									overlayClose:false,
									escClose:false,
									persist:true,
									opacity:20,
									onOpen: function (dialog) {
										dialog.overlay.fadeIn(100, function () {
											dialog.container.fadeIn(5, function () {
												dialog.data.fadeIn('fast');
											});
										});
									},
								});
								$('input[name="edit_solution"]').parent().parent().find('th').attr('style','color:red');
								$('input[name="edit_solution"]').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
								$('select[name="event_select_solution"] option:selected').removeAttr('selected');
								$('select[name="event_select_solution"] option[value="'+solution_id+'"]').remove();
								$('select[name="select_solution"] option[value="'+solution_id+'"]').remove();
								$('#simplemodal-container').css('height', 'auto');
								solution_id = null;
							}, 30);
						} else {
							//Display refusal
							$('#solution_delete_refused').show();
							//Restore panel
							$('#solution_delete').parent().parent().find('td').eq(0).find('span').html('');
							$('#solution_delete').parent().parent().find('td').eq(1).find('span').html('');
							$('#solution_delete').show();
							$('#solution_duplicate').show();
							$('#solution_cancel').show();
							$('#solution_done').show();
						};
					}
				});
				
			});
		});
		//Set cancel function
		$('#solution_cancel').unbind('click');
		$('#solution_cancel').click(function(){
			//Close modal without saving
			$.modal.close();
			//Come back to event modal
			window.setTimeout(function() {
				event_modal = $("#event").modal({
					overlayClose:false,
					escClose:false,
					persist:true,
					opacity:20,
					onOpen: function (dialog) {
						dialog.overlay.fadeIn(100, function () {
							dialog.container.fadeIn(5, function () {
								dialog.data.fadeIn('fast');
							});
						});
					},
				});
				$('#simplemodal-container').css('height', 'auto');
			}, 30);
		});
		//Set done function
		$('#solution_done').unbind('click');
		$('#solution_done').click(function(){
			var flag_ok = true;
			if ($('#solution_name_warning').is(":visible")) {
				flag_ok = false;
			} else {
				if (solution_ratios.length == 0) {
					flag_ok = false;
				} else {
					for (var iC = solution_ratios.length - 1; iC >= 0; iC--) {
						if (isNaN(parseFloat(solution_ratios[iC]))){
							flag_ok = false;
							break;
						} else {
							if (!((parseFloat(solution_ratios[iC]) >= 0) && (parseFloat(solution_ratios[iC]) <= 1))) {
								flag_ok = false;
								break;
							};
						}
					};
				};
			};
			if (flag_ok) {
				//Save solution
				if (solution_id != null) {
					$.ajax({
						url: '{{=URL("store_solution.json")}}',
						data: {solution_id:solution_id, var_name:'name', val: solution_name},
						traditional: true
					});
					$.ajax({
						url: '{{=URL("store_solution.json")}}',
						data: {solution_id:solution_id, var_name:'components_name', val: solution_components},
						traditional: true
					});
					$.ajax({
						url: '{{=URL("store_solution.json")}}',
						data: {solution_id:solution_id, var_name:'components_ratio', val: solution_ratios},
						traditional: true
					});
				} else {
					$.ajax({
						url: '{{=URL("store_solution.json")}}',
						data: {var_name:'name', val: solution_name},
						traditional: true,
						success: function(data){
							solution_id = data['id'];
							//add to select_option et al.
							$('select[name="select_solution"]').append('<option value='+solution_id+'>'+solution_name+'</option>');
							$('select[name="event_select_solution"]').append('<option value='+solution_id+'>'+solution_name+'</option>');
							$('select[name="event_select_solution"] option[value="'+solution_id+'"]').attr('selected','selected');
							$('input[name="edit_solution"]').parent().parent().find('th').removeAttr('style');
							$('input[name="edit_solution"]').removeAttr("disabled").removeAttr("style");
							//save
							$.ajax({
								url: '{{=URL("store_solution.json")}}',
								data: {solution_id:solution_id, var_name:'components_name', val: solution_components},
								traditional: true
							});
							$.ajax({
								url: '{{=URL("store_solution.json")}}',
								data: {solution_id:solution_id, var_name:'components_ratio', val: solution_ratios},
								traditional: true
							});
						}
					});
				}
				//Close modal without saving
				$.modal.close();
				//Come back to event modal
				window.setTimeout(function() {
					event_modal = $("#event").modal({
						overlayClose:false,
						escClose:false,
						persist:true,
						opacity:20,
						onOpen: function (dialog) {
							dialog.overlay.fadeIn(100, function () {
								dialog.container.fadeIn(5, function () {
									dialog.data.fadeIn('fast');
								});
							});
						}
					});
					$('#simplemodal-container').css('height', 'auto');
					//Update select_option
					if (solution_id != null) {
						for (var iS = $('select[name="select_solution"] option').size() - 1; iS >= 0; iS--) {
							if (solution_id == $('select[name="select_solution"] option').eq(iS).val()) {
								if (solution_name != $('select[name="select_solution"] option').eq(iS).text()) {
									//Update
									$('select[name="select_solution"] option').eq(iS).text(solution_name)
								}
								break;
							}
						}
						for (var iS = $('select[name="event_select_solution"] option').size() - 1; iS >= 0; iS--) {
							if (solution_id == $('select[name="event_select_solution"] option').eq(iS).val()) {
								if (solution_name != $('select[name="event_select_solution"] option').eq(iS).text()) {
									//Update
									$('select[name="event_select_solution"] option').eq(iS).text(solution_name)
								}
								break;
							}
						}
					}
				}, 30);
			} else {
				$('#solution_warning').show();
			};
		});
		//Create solution modal window
		window.setTimeout(function() {
			solution_modal = $("#solution").modal({
				overlayClose:false,
				escClose:false,
				opacity:20,
				onOpen: function (dialog) {
					dialog.overlay.fadeIn(100, function () {
						dialog.container.fadeIn(5, function () {
							dialog.data.fadeIn('fast');
						});
					});
				},
			});
			$('#simplemodal-container').css('height', 'auto');
		}, 5);
	}

	var p
	var distance
	var selectedPoint = null;
	var selectedPoints = g.selPoints_;
	// Find out if the click occurs on a point.
	var closestIdx = -1;
	var closestDistance = Number.MAX_VALUE;
	// check if the click was on a particular point.
	for (var i = 0; i < selectedPoints.length; i++) {
		p = selectedPoints[i];
		distance = Math.pow(p.canvasx - context.dragStartX, 2) + Math.pow(p.canvasy - context.dragStartY, 2);
		if (!isNaN(distance) && (closestIdx == -1 || distance < closestDistance)) {
			closestDistance = distance;
			closestIdx = i;
		}
	}
	// Allow any click within two pixels of the dot.
	var radius = g.attr_('highlightCircleSize') + 2;
	if (closestDistance <= radius * radius) {
		selectedPoint = selectedPoints[closestIdx];
	}
	
	var time = selectedPoints[closestIdx].xval;

	var radiustime = (g.dateWindow_ == null) ? ((g.rawData_[g.rawData_.length-1][0] - g.rawData_[0][0])/124) : ((g.dateWindow_[1] - g.dateWindow_[0])/124);
	var closestiE = -1;
	// Detect if their is an existing event
	for (var iE = eventT.length - 1; iE >= 0; iE--) {
		if (Math.abs(eventT[iE] - time) < radiustime) {
			radiustime = Math.abs(eventT[iE] - time);
			closestiE = iE;
		}
	};
	if (closestiE != -1) {
		time = eventT[closestiE];
	};

	var series_id = -1;
	var series_name = 'all';
	var solution_id = null;
	var solution_name = '';
	var solution_components = [];
	var solution_ratios = [];
	var volume = '';
	var concentration = '';
	var comment = '';
	var type = 'comment';
	if (selectedPoint) {
		series_id = closestIdx;
		series_name = selectedPoint.name;
	}
	var flag_unique = true;
	
	$.ajax({
		url: '{{=URL("store_event.json")}}',
		data: {flise_record_id:cur_id, time:time, series_id:series_id},
		traditional: true,
		success: function(data){
			var flag_add = true;
			if (!(Object.getOwnPropertyNames(data).length === 0)){
				//load values
				type = data['type'];
				series_name = data['series_name'];
				volume = data['volume'];
				concentration = data['concentration'];
				comment = data['comment'];
				solution_id = data['solution_id'];
				if (volume == null) {volume=''};
				if (concentration == null) {concentration=''};
				//Set flag not to add annotation
				flag_add = false;
			}
			//Create corresponding panel
			$.get('{{=URL(request.application, 'static/templates','event.html')}}', function(htmlstr) {
				//Reset the panel
				$('#event').html('');
				//Adapt panel HTML
				var st = htmlstr;
				var stopt;
				if (series_id == -1){
					stopt='<option value="wash">wash</option> <option value="injection">injection</option> <option value="dilution">dilution</option> <option value="removal">removal</option>';
				} else {
					stopt='<option value="calibration">calibration</option>';
				}
				st = st.replace(/%time%/,time);
				st = st.replace(/%series_name%/,series_name);
				st = st.replace(/%volume%/, volume)
				st = st.replace(/%concentration%/, concentration);
				st = st.replace(/%comment%/, comment);
				st = st.replace(/%options%/, stopt);
				st = st.replace(/%select_solution%/, $('#solutions_store > div').html());
				$('#event').append(st);
				$('input[name="edit_solution"]').parent().find('select[name="select_solution"]').attr('name','event_select_solution');
				$('input[name="edit_solution"]').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				$('#event_warning').hide();

				//Select
				if (!(solution_id==null)){
					$('select[name="event_select_solution"] option[value="'+solution_id+'"]').attr('selected', 'selected');
					$('input[name="edit_solution"]').removeAttr("disabled").removeAttr("style");
				}
				$('#event_type > option[value='+type+']').attr('selected','selected');
				$('#event_type').unbind('change');
				$('#event_type').change(function(){
					//Save type
					type = $(this).val();
					//Update hidden fields
					$('input[name="add_solution"]').parent().parent().show();
					$('input[name="event_volume"]').parent().parent().show();
					$('input[name="event_concentration"]').parent().parent().show();
					switch(type)
					{
					case 'comment':
					  $('input[name="add_solution"]').parent().parent().hide();
					  $('input[name="event_volume"]').parent().parent().hide();
					  $('input[name="event_concentration"]').parent().parent().hide();
					  break;
					case 'wash':
					  $('input[name="event_concentration"]').parent().parent().hide();
					  break;
					case 'removal':
					  $('input[name="add_solution"]').parent().parent().hide();
					  $('input[name="event_concentration"]').parent().parent().hide();
					  break;
					case 'dilution':
					  $('input[name="add_solution"]').parent().parent().hide();
					  $('input[name="event_concentration"]').parent().parent().hide();
					  break;
					case 'calibration':
					  $('input[name="add_solution"]').parent().parent().hide();
					  $('input[name="event_volume"]').parent().parent().hide();
					  break;
					default:
					  break;
					}
				});
				//Solution input
				$('select[name="event_select_solution"]').unbind('change');
				$('select[name="event_select_solution"]').change(function(){
					$('input[name="edit_solution"]').removeAttr("disabled").removeAttr("style");
					//Save new solution reference
					solution_id = $(this).val();
					$('input[name="edit_solution"]').parent().parent().find('th').removeAttr('style');
					if (solution_id == ''){
						$('input[name="edit_solution"]').parent().parent().find('th').attr('style','color:red');
						$('input[name="edit_solution"]').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
						solution_id = null;
					}
				});
				//Solution edit
				$('input[name="edit_solution"]').unbind('click');
				$('input[name="edit_solution"]').click(function(){
					if (solution_id == null) {
						//Block edit button: this may happen when duplicating a solution then cancelling (the link to previous solution is broken) <- TODO: prevent this to happen
						$('input[name="edit_solution"]').parent().parent().find('th').attr('style','color:red');
						$('input[name="edit_solution"]').attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
					} else {
						//Close event modal window
						$.modal.close();
						//Create corresponding panel
						$.get('{{=URL(request.application, 'static/templates','solution.html')}}', function(htmlstr) {
							//Get the corresponding solution content
							$.ajax({
								url: '{{=URL("store_solution.json")}}',
								data: {solution_id:solution_id},
								traditional: true,
								success: function(data){
									solution_name = '';
									solution_components = [];
									solution_ratios = [];
									if (!(Object.getOwnPropertyNames(data).length === 0)){
										//load values
										solution_name = data['name'];
										solution_components = data['components_name'];
										solution_ratios = data['components_ratio'];
										flag_unique = data['flagUnique'];
									}
									solution_panel(htmlstr);
								}
							});
						});
					};
				});
				//Solution add
				$('input[name="add_solution"]').unbind('click');
				$('input[name="add_solution"]').click(function(){
					//Close event modal window
					$.modal.close();
					//Create corresponding panel
					$.get('{{=URL(request.application, 'static/templates','solution.html')}}', function(htmlstr) {
						//Detach from previous solution
						solution_id = null;
						$('select[name="event_select_solution"] option:selected').removeAttr('selected');
						//Init var
						solution_name = '';
						solution_components = [];
						solution_ratios = [];
						//Create panel and change modal
						solution_panel(htmlstr);
					});
				});
				//Volume reference input
				$('input[name="event_volume"]').unbind('change');
				$('input[name="event_volume"]').change(function(){
					//Save volume
					volume = $(this).val();
					$('input[name="event_volume"]').parent().parent().find('th').removeAttr('style');
					if (isNaN(parseFloat(volume))){
						$('input[name="event_volume"]').parent().parent().find('th').attr('style','color:red');
					} else {
						volume = String(parseFloat(volume));
						$('input[name="event_volume"]').val(volume);
					}
				});
				//Concentration reference input
				$('input[name="event_concentration"]').unbind('change');
				$('input[name="event_concentration"]').change(function(){
					//Save concentration
					concentration = $(this).val();
					$('input[name="event_concentration"]').parent().parent().find('th').removeAttr('style');
					if (isNaN(parseFloat(concentration))){
						$('input[name="event_concentration"]').parent().parent().find('th').attr('style','color:red');
					} else {
						concentration = String(parseFloat(concentration));
						$('input[name="event_concentration"]').val(concentration);
					}
				});
				//Comment free text area
				$('textarea[name="event_comment"]').unbind('change');
				$('textarea[name="event_comment"]').change(function(){
					//Save comment
					comment = $(this).val();
				});

				//Set cancel function
				$('#event_cancel').unbind('click');
				$('#event_cancel').click(function(){
					//Close without saving
					$.modal.close();
				});
				//Set done function
				$('#event_done').unbind('click');
				$('#event_done').click(function(){
					//Check that fields are correctly entered
					var flag_ok = true;
					var flag_ok_sol = true;
					var flag_ok_vol = true;
					var flag_ok_con = true;
					//$('input[name="edit_solution"]').parent().parent().find('th').removeAttr('style');
					if (solution_id == null){
						flag_ok_sol = false;
						$('input[name="edit_solution"]').parent().parent().find('th').attr('style','color:red');
					}
					//$('input[name="event_volume"]').parent().parent().find('th').removeAttr('style');
					if (isNaN(parseFloat(volume))){
						flag_ok_vol = false;
						$('input[name="event_volume"]').parent().parent().find('th').attr('style','color:red');
					}
					//$('input[name="event_concentration"]').parent().parent().find('th').removeAttr('style');
					if (isNaN(parseFloat(concentration))){
						flag_ok_con = false;
						$('input[name="event_concentration"]').parent().parent().find('th').attr('style','color:red');
					}
					switch(type)
					{
					case 'injection':
					  if (!(flag_ok_sol && flag_ok_vol && flag_ok_con)) {flag_ok = false;};
					  break;
					case 'wash':
					  if (!(flag_ok_sol && flag_ok_vol)) {flag_ok = false;};
					  break;
					case 'removal':
					  if (!(flag_ok_vol)) {flag_ok = false;};
					  break;
					case 'dilution':
					  if (!(flag_ok_vol)) {flag_ok = false;};
					  break;
					case 'calibration':
					  if (!(flag_ok_con)) {flag_ok = false;};
					  break;
					default:
					  break;
					}
					if (flag_ok) {
						//Save
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
						if (!(solution_id == null)){
							$.ajax({
								url: '{{=URL("store_event.json")}}',
								data: {flise_record_id:cur_id, time:time, series_id:series_id, var_name:'solution_id', val: solution_id},
								traditional: true
							});
						}
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
						save2undo();
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
						if (flag_add) {
							// add to g annotations
							if (series_id==-1){
								for (var i = 0; i < selectedPoints.length; i++) {
									if (!(selectedPoints[i].annotation)){
										anns.push({
											series: selectedPoints[i].name,
											xval: time,
											icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
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
										icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
										width: 16,
										height: 16,
										tickHeight: 2,
										text: type
									};
									anns.push(ann);
								}
							}
						} else {
							//if it was already existing, we just need to update g annotations text
							for (var iA = anns.length - 1; iA >= 0; iA--) {
								if (anns[iA].xval == time){
									if (series_id==-1){
										anns[iA].text = type;
									} else {
										if (anns[iA].series == series_name) {
											anns[iA].text = type;
										};
									}
								}
							};
						};
						g.setAnnotations(anns);

						//Close model window
						$.modal.close();
					} else {
						$('#event_warning').show();
					};
				});

				//Show options
				event_modal = $("#event").modal({
					overlayClose:false,
					escClose:false,
					persist:true,
					opacity:20,
					onOpen: function (dialog) {
						dialog.overlay.fadeIn(100, function () {
							dialog.container.fadeIn(5, function () {
								dialog.data.fadeIn('fast');
							});
						});
					},
				});
				$('#simplemodal-container').css('height', 'auto');
				//Hide fields according to type
				switch(type)
				{
				case 'comment':
				  $('input[name="add_solution"]').parent().parent().hide();
				  $('input[name="event_volume"]').parent().parent().hide();
				  $('input[name="event_concentration"]').parent().parent().hide();
				  break;
				case 'wash':
				  $('input[name="event_concentration"]').parent().parent().hide();
				  break;
				case 'removal':
				  $('input[name="add_solution"]').parent().parent().hide();
				  $('input[name="event_concentration"]').parent().parent().hide();
				  break;
				case 'dilution':
				  $('input[name="add_solution"]').parent().parent().hide();
				  $('input[name="event_concentration"]').parent().parent().hide();
				  break;
				case 'calibration':
				  $('input[name="add_solution"]').parent().parent().hide();
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
							if (event.altKey || event.shiftKey) {
								Dygraph.defaultInteractionModel.mousedown(event, g, context);
							} else {
								context.initializeMouseDown(event, g, context);
								if (tool == 'nodiff' || tool == 'drop'  || tool == 'cancel') {
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
						}
					},
					mousemove: function (event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.mousemove(event, g, context);
						} else {
							if (!isSelecting) {
								if (event.altKey || event.shiftKey) {
									Dygraph.defaultInteractionModel.mousemove(event, g, context);
								} else {
									return;
								}
							} else {
								drawSelectRect(event, g, context);
							}
						}
					},
					mouseup: function(event, g, context) {
						if (tool == 'zoom') {
							Dygraph.defaultInteractionModel.mouseup(event, g, context);
						} else {
							if (isSelecting) {
								eraseSelectRect(g, context);
							};
							if (event.altKey || event.shiftKey) {
								Dygraph.defaultInteractionModel.mousemove(event, g, context);
							} else if (tool == 'nodiff' || tool == 'drop'  || tool == 'cancel') {
								if (tool == 'nodiff'){
									if (context.prevEndX != null){
										add2nodiff(getX(context.dragStartX,g),getX(context.dragEndX,g));
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
				strokeWidth: 1.2,
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


/**************** INIT Graph and controls ********************/
function initGraph(cur_id, name){

	//Show data extraction zone
	$('#my_records').slideUp();
	$('#edit_record').slideUp();
	$('#section_data').parent().attr('style','width:455px');
	$('#section_data').show('slow');
	//Show which file is selected
	$('.current_record').html(name)
		.attr('id', cur_id)
		.show()
		.prev().show();
	//Rearrange which panel is developped or not
	$('#upload_flise').slideUp();
	$('#edit_record').slideDown();
	$('#series_options').slideUp();
	$('#global_options').slideUp();
	$('#section_file').slideToggle();
	//Refresh Previous state Variables
	prevcutT = [];
	prevnodiffT = [];
	prevdropT = [];
	preveventT = [];
	event_del = [];
	dataT = [];
	
	//***** Load time-series and associated data, then display graph and initiate callbacks
	makeGraph();

	//***** Load options and create corresponding panels
	$.getJSON('{{=URL('get_options.json')}}/'+cur_id,function(data){
		//***** Load series options
		//Reset the panel
		$('#series_options').html('');
		//Color choice for timeseries
		var colors = data.color;
		//If not previously defined, use the default color from dygraph
		for (var i = colors.length - 1; i >= 0; i--) {
			if (colors[i] == null) colors[i] = g.colors_[i];
		};
		g.updateOptions({'colors':colors, 'visibility': data.show});
		//Adapt panel HTML
		for (var i = 0;i<data.num_series;i++){
			var st = series_template;
			st = st.replace(/%select_species%/, $('#species_store > div').html());
			if(data.show[i] == true) st = st.replace(/%show%/, 'checked');
			else st = st.replace(/%show%/, '');
			st = st.replace(/%color%/, colors[i]);
			st = st.replace(/%calibration_slope%/, (data.slope[i]=='null' || data.slope[i]==null) ? '' : data.slope[i])
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
			graph_labels = [];
			$('select[name="select_species"]').each(function(){
				if (! $(this).val() ) graph_labels.push('Species');
				else graph_labels.push($(this).val());
			});
			graph_labels = graph_labels.slice(0,-1)
			//Save new series name
			$.ajax({
				url: '{{=URL("store_option")}}',
				data: {record_id:cur_id, var_name:'series_species', val: graph_labels},
				traditional: true
			});
			//Update series name in g, and eventually add number if same name for several series
			var listSim=[];
			var flag=false;
			var iL;
			for (var i=0; i<graph_labels.length-1; i++){
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
					for (var j=i+1; j<graph_labels.length; j++){
						if (graph_labels[i]==graph_labels[j]){
							listSim[iL].push(j);
						}
					}
					//alter names with index so that graph labels are different
					if (listSim[iL].length>1){
						for (var j=0; j<listSim[iL].length; j++){
							graph_labels[listSim[iL][j]]=graph_labels[listSim[iL][j]]+j;
						}
					}
				}
			}
			graph_labels.splice(0,0,"Time");
			g.updateOptions({'labels':graph_labels});
			//Update series name db.event and series name in g annotations
			for (var iE=0; iE<eventT.length; iE++) {
				if (!(iE == eventT.length-1)){
					for (var series_id=-1;series_id<graph_data[0].length-1;series_id++){
						$.ajax({
							url: '{{=URL("store_event.json")}}',
							data: {flise_record_id:cur_id, time:eventT[iE], series_id:series_id},
							traditional: true,
							success: function(data){
								if (!(Object.getOwnPropertyNames(data).length === 0)){
									//if found, update db.event
									if (!(data['series_id']==-1)){
										$.ajax({
											url: '{{=URL("store_event.json")}}',
											data: {flise_record_id:data['flise_file_id'], time:data['time'], series_id:data['series_id'], var_name:'series_name', val: g.attr_('labels')[data['series_id']+1]},
											traditional: true
										});
									}
									//add it to g annotations
									if (data['series_id']==-1){
										var flag = true;
									} else {
										var flag = false;
									}
									for (var iA = g.annotations_.length - 1; iA >= 0; iA--) {
										if (g.annotations_[iA].xval == data['time']){
											if (flag){
												g.annotations_.splice(iA,1);
											} else {
												if (g.annotations_[iA].series == data['series_name']) {
													g.annotations_[iA].series = g.attr_('labels')[data['series_id']+1];
												};
											}
										}
									};
									if (flag) {
										for (var i = 0; i < g.colors_.length; i++) {
											g.annotations_.push({
												series: g.user_attrs_['labels'][i+1],
												xval: data['time'],
												icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
												width: 16,
												height: 16,
												tickHeight: 2,
												text: data['type']
											});
										}
									}
								}
							}
						});
					}
				} else {
					for (var series_id=-1;series_id<graph_data[0].length-1;series_id++){
						$.ajax({
							url: '{{=URL("store_event.json")}}',
							data: {flise_record_id:cur_id, time:eventT[iE], series_id:series_id},
							traditional: true,
							success: function(data){
								if (!(Object.getOwnPropertyNames(data).length === 0)){
									//if found, update db.event
									if (!(data['series_id']==-1)){
										$.ajax({
											url: '{{=URL("store_event.json")}}',
											data: {flise_record_id:data['flise_file_id'], time:data['time'], series_id:data['series_id'], var_name:'series_name', val: g.attr_('labels')[data['series_id']+1]},
											traditional: true
										});
									}
									//add it to g annotations
									if (data['series_id']==-1){
										var flag = true;
									} else {
										var flag = false;
									}
									for (var iA = g.annotations_.length - 1; iA >= 0; iA--) {
										if (g.annotations_[iA].xval == data['time']){
											if (flag){
												g.annotations_.splice(iA,1);
											} else {
												if (g.annotations_[iA].series == data['series_name']) {
													g.annotations_[iA].series = g.attr_('labels')[data['series_id']+1];
												};
											}
										}
									};
									if (flag) {
										for (var i = 0; i < g.colors_.length; i++) {
											g.annotations_.push({
												series: g.user_attrs_['labels'][i+1],
												xval: data['time'],
												icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
												width: 16,
												height: 16,
												tickHeight: 2,
												text: data['type']
											});
										}
									}
									//Update annotation display
									g.setAnnotations(g.annotations_);
								}
							}
						});
					}
				}
			}
			//Update event_del[].series_name
			for (var i = event_del.length - 1; i >= 0; i--) {
				if (!(event_del[i].series_id == -1)) {
					event_del[i].series_name=items[event_del[i].series_id+1];
				};
			};
		});
		//Color picker creation
		$('input[name="color"]').unbind('change');
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
			if (typeof g2 === "undefined")
				g.updateOptions({visibility: vis});
			else {
				if ($("#overlay").is(':checked'))
					g.updateOptions({visibility: vis.concat(vis)});
				else
					g.updateOptions({visibility: vis});
				g2.updateOptions({visibility: vis});
			}

			//Save
			$.ajax({
				url: '{{=URL("store_option")}}',
				data: {record_id:cur_id, var_name:'series_show', val: vis},
				traditional: true
			});
		});
		//Calibration slope
		$('input[name="calibration_slope"]').unbind('change');
		$('input[name="calibration_slope"]').change(function(){
			var items = [];
			$('input[name="calibration_slope"]').each(function(){
				items.push(($(this).val()=='') ? null : $(this).val());
			});
			//Save calibration_slope change
			$.ajax({
				url: '{{=URL("store_option")}}',
				data: {record_id:cur_id, var_name:'series_slope', val: items},
				traditional: true
			});
		});
		//now that the series have a correct naming, disp event
		g.setAnnotations(g.annotations());
		//switch button
		//$('input[name="show"]').checkbox(); ********************************************************************************************
		//disp panel
		$('#series_options').slideDown();

		//***** Load global series options
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
				url: '{{=URL("store_strain")}}',
				data: {record_id:cur_id, val: $(this).val()},
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
			$(this).parent().find('span').eq(0).html($(this).val());
		});
		//Update smooth value
		$('input[name="smooth_val"]').change(function(){
			$(this).parent().find('span').eq(0).html($(this).val());
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

		//***** Load autosegmentation panel
		$.get('{{=URL(request.application, 'static/templates','autoseg_options.html')}}', function(data) {
			var autoseg_str = data;
			//Reset the panel
			$('#autoseg_options').html('');
			//Create panel
			autoseg_str = autoseg_str.replace(/%autoseg_win%/, data.autoseg_win);
			autoseg_str = autoseg_str.replace(/%autoseg_fuse%/, data.autoseg_fuse);
			$('#autoseg_options').append(autoseg_str);
			//Unbind
			$('input[class="segmentation_slider"]').unbind();
			//Value next to slider
			$('input[class="segmentation_slider"]').each(function(){
				$(this).parent().find('span').html($(this).val());
			});
			//When slider moves, update displayed value
			$('input[class="segmentation_slider"]').change(function(){
				$(this).parent().find('span').html($(this).val());
			});
			//Update in db
			$('#locw').mouseup(function(){
				//Save new smooth_value
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'autoseg_win', val: $(this).val()},
					traditional: true
				});
			});
			$('#fusw').mouseup(function(){
				//Save new smooth_value
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'autoseg_fuse', val: $(this).val()},
					traditional: true
				});
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
				nodiffT = aOa_cp_val(prevnodiffT);
				dropT = aOa_cp_val(prevdropT);
				eventT = preveventT.slice();
				unifyT();
				$("#autoseg").removeAttr("disabled").removeAttr("style");
			});
			//Default button unabling
			$("#autoseg").removeAttr("disabled").removeAttr("style");
			$("#revertseg").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
		});

		//***** Load Tools panel
		$.get('{{=URL(request.application, 'static/templates','tools.html')}}', function(data) {
			//Initialize tool variables
			isSelecting = false;
			tool = 'zoom'; // Default tool
			
			//Reset panel
			$('#tools').html('');
			//Load the panel
			htmlstr = data;
			htmlstr = htmlstr.replace(/%img%/g, "{{=URL(request.application, 'static/icons', '%img%')}}");
			htmlstr = htmlstr.replace(/%img%/g, "");
			$('#tools').append(htmlstr);
			$('#tools_info').hide();
			
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
				nodiffT = aOa_cp_val(prevnodiffT);
				dropT = aOa_cp_val(prevdropT);
				unifyT();
				// remove added evenT
				var flag
				for (var iE=0; iE<eventT.length; iE++) {
					flag = true;
					for (var iP = preveventT.length - 1; iP >= 0; iP--) {
						if (preveventT[iP] == eventT[iE]){
							flag = false;// flag marking a difference was not found, meaning it was there before, and as a consequence, no undo applies...
							break;
						}
					};
					if (flag){
						//remove from db
						for (var iS=-1;iS<graph_data[0].length-1;iS++){
							//loop to find the correct series: drawback = if several events at the same time index, all of them could be removed, but in fact, since we can only undo once, none of them are to be removed. (BUG)
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
				// add removed evenT
				var flag_exist
				var anns = g.annotations();
				for (var iP = preveventT.length - 1; iP >= 0; iP--) {
					flag = true;
					for (var iE=0; iE<eventT.length; iE++) {
						if (preveventT[iP] == eventT[iE]){
							flag = false;// flag marking a difference was not found, meaning it was there before, and as a consequence, no undo applies...
							break;
						}
					};
					if (flag){
						//add db
						for (var iE = event_del.length - 1; iE >= 0; iE--) {
							if (event_del[iE].time == preveventT[iP]){
								//create it
								$.ajax({
									url: '{{=URL("store_event.json")}}',
									data: {flise_record_id:event_del[iE].flise_file_id, time:event_del[iE].time, series_id:event_del[iE].series_id, var_name:'type', val: event_del[iE].type},
									traditional: true
								});
								$.ajax({
									url: '{{=URL("store_event.json")}}',
									data: {flise_record_id:event_del[iE].flise_file_id, time:event_del[iE].time, series_id:event_del[iE].series_id, var_name:'series_name', val: event_del[iE].series_name},
									traditional: true
								});
								if (!(event_del[iE].solution_id == null)){
									$.ajax({
										url: '{{=URL("store_event.json")}}',
										data: {flise_record_id:event_del[iE].flise_file_id, time:event_del[iE].time, series_id:event_del[iE].series_id, var_name:'solution_id', val: event_del[iE].solution_id},
										traditional: true
									});
								}
								if (event_del[iE].volume == null) {event_del[iE].volume=''};
								$.ajax({
									url: '{{=URL("store_event.json")}}',
									data: {flise_record_id:event_del[iE].flise_file_id, time:event_del[iE].time, series_id:event_del[iE].series_id, var_name:'volume', val: event_del[iE].volume},
									traditional: true
								});
								if (event_del[iE].concentration == null) {event_del[iE].concentration=''};
								$.ajax({
									url: '{{=URL("store_event.json")}}',
									data: {flise_record_id:event_del[iE].flise_file_id, time:event_del[iE].time, series_id:event_del[iE].series_id, var_name:'concentration', val: event_del[iE].concentration},
									traditional: true
								});
								$.ajax({
									url: '{{=URL("store_event.json")}}',
									data: {flise_record_id:event_del[iE].flise_file_id, time:event_del[iE].time, series_id:event_del[iE].series_id, var_name:'comment', val: event_del[iE].comment},
									traditional: true
								});
								//add to g
								if (event_del[iE].series_id==-1){
									for (var i = 0; i < g.colors_.length; i++) {
										anns.push({
											series: g.user_attrs_['labels'][i+1],
											xval: event_del[iE].time,
											icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
											width: 16,
											height: 16,
											tickHeight: 2,
											text: event_del[iE].type
										});
									}
								} else {
									anns.push({
										series: g.user_attrs_['labels'][event_del[iE].series_id+1],
										xval: event_del[iE].time,
										icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
										width: 16,
										height: 16,
										tickHeight: 2,
										text: event_del[iE].type
									});
								}
								event_del.splice(iE,1);
							}
						};
					}
				}
				g.setAnnotations(anns);
				//save eventT to db.flise_file
				eventT = preveventT.slice();
				get_set_flisefile_option(cur_id, 'eventT');
			});
			$("#revert_tool").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
		});


		//***** Load preprocessing panel
		$.get('{{=URL(request.application, 'static/templates','preprocessing.html')}}', function(data) {
			var sg_str = data;
			//Reset panel
			$('#deriv').html('');
			//Load panel
			//Load values
			sg_str = sg_str.replace(/%sg_win%/, data.sg_win);
			sg_str = sg_str.replace(/%sg_order%/, data.sg_order);
			if(data.sg_overlay == true){
				sg_str = sg_str.replace(/%sg_overlay%/, 'checked');
			} else {
				sg_str = sg_str.replace(/%sg_overlay%/, '');
			}
			//Write panel
			$('#deriv').append(sg_str);
			//Hide info
			$('#SG_info').hide();
			//Value next to slider
			$('input[class="savgol_slider"]').unbind();
			$('input[class="savgol_slider"]').each(function(){
				$(this).parent().find('span').html($(this).val());
			});
			$('input[class="savgol_slider"]').change(function(){
				$(this).parent().find('span').html($(this).val());
			});
			//Update in db
			$('#lochw').mouseup(function(){
				//Save new smooth_value
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'sg_win', val: $(this).val()},
					traditional: true
				});
			});
			$('#order').mouseup(function(){
				//Save new smooth_value
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'sg_order', val: $(this).val()},
					traditional: true
				});
			});
			//Check box to activate or not overlay of smoothed data on original series
			$('#overlay').unbind('click');
			$('#overlay').click(function(){
				$.ajax({
					url: '{{=URL("store_option")}}',
					data: {record_id:cur_id, var_name:'sg_overlay', val: $(this).is(':checked')},
					traditional: true
				});
			});
			//Force local window to be big enought for polynomial order: min loc half window (lochw) of size 6 and max polynomial order (porder) of 10 insures that porder<2*lochw.
			//Preprocessing button
			$('#preproc').unbind('click');
			$('#preproc').click(function(){
				//Disable button
				$("#preproc").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				$("#preproc_close").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				//Substract from segmentation intervals the intervals not to differentiate
				function rmInInt(sInt, lInt){
					if (sInt[0]>=lInt[0] && sInt[1]<=lInt[1]) {
						if (sInt[0]!=lInt[0]) {diffdataT.push([lInt[0], sInt[0]]);};
						return [sInt[1], lInt[1]];
					} else {
						if (lInt[0]!=lInt[1]) {diffdataT.push(lInt);};
						return [];
					};
				}
				var diffdataT = [];
				var iD = 0;
				var resInt = dataT[iD].slice();
				for (var iN = 0; iN < nodiffT.length; iN++) {
					flag = true;
					while (flag){
						resInt = rmInInt(nodiffT[iN].slice(), resInt);
						if (resInt.length == 0) {
							iD++;
							resInt = dataT[iD].slice();
						} else {
							flag = false;
						};
					};
				};
				if (nodiffT.length!=0) {
					if (resInt[0]!=resInt[1]) {
						diffdataT.push(resInt);
					};
					iD++;
				};
				for (var iD2 = iD; iD2 < dataT.length; iD2++) {
					diffdataT.push(dataT[iD2].slice());
				};
				//Get processing parameters
				var lochw = parseFloat($("#lochw").attr("value"));
				var porder = parseFloat($("#order").attr("value"));
				//Shape data to smooth/derivate
				var data2derive=[];
				var Tsamp=(graph_data[1][0]-graph_data[0][0]);
				var iDpass=0;
				for (var iD=0; iD<diffdataT.length; iD++){
					//prevent small intervals to be passed
					if (Math.ceil((diffdataT[iD][1]-diffdataT[iD][0])/Tsamp)<=(2*lochw+1)){
						iDpass++;
						continue;
					}
					//collect interval
					data2derive.push([]);
					for (var iS=1; iS<graph_data[0].length;iS++){
						data2derive[iD-iDpass].push([]);
						data2derive[iD-iDpass][iS-1]=[];
						for (var iP=0; iP<graph_data.length;iP++){
							if ((graph_data[iP][0]>=diffdataT[iD][0])&&(graph_data[iP][0]<=diffdataT[iD][1])){
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
						for (var iI=0; iI<diffdataT.length; iI++){
							//prevent small intervals to be passed
							if (Math.ceil((diffdataT[iI][1]-diffdataT[iI][0])/Tsamp)<=(2*lochw+1)){
								iIpass++;
								continue;
							}
							//find index when graph_data[iP][0]==diffdataT[iI][0]
							for (iP=0; iP<graph_data.length;iP++){
								if (graph_data[iP][0]==diffdataT[iI][0]){break;}
							}
							//place values
							for (iS=0; iS<result[iI-iIpass].length;iS++){
								for (var iP2=0; iP2<result[iI-iIpass][iS].length;iP2++){
									data2plot[iP+iP2][iS+1]=result[iI-iIpass][iS][iP2] / Tsamp;
								}
							}
						}
						//Plot
						$('#graphdiv2').show();
						var derivlabels=['Time'];
						for (var i=0; i<graph_labels.length; i++){
							derivlabels.push('SG1_'+graph_labels[i+1]);
						}
						var colors = [];
						$('input[name="color"]').each(function(){
							colors.push($(this).val());
						});
						var vis = []
						$('input[name="show"]').each(function (){
							if ($(this).is(':checked')) vis.push(true);
							else vis.push(false);
						});
						g2 = new Dygraph(document.getElementById("graphdiv2"), data2plot,
							{
								labels: derivlabels,
								colors: colors,
								visibility: vis,
								dateWindow: g.xAxisRange(),
								width: window.innerWidth-510,
								height: Math.floor((window.innerHeight-90)/2),
								strokeWidth: 1.2,
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
										if (tool == 'zoom' || (event.altKey || event.shiftKey)) {
											Dygraph.defaultInteractionModel.mousedown(event, me, context);
										}
									},
									mousemove: function (event, me, context) {
										if (tool == 'zoom' || (event.altKey || event.shiftKey)) {
											Dygraph.defaultInteractionModel.mousemove(event, me, context);
										}
									},
									mouseup: function(event, me, context) {
										if (tool == 'zoom' || (event.altKey || event.shiftKey)) {
											Dygraph.defaultInteractionModel.mouseup(event, me, context);
										}
									},
									mouseout: function(event, me, context) {
										if (tool == 'zoom' || (event.altKey || event.shiftKey)) {
											Dygraph.defaultInteractionModel.mouseout(event, me, context);
										}
									},
									dblclick: function(event, me, context) {
										if (tool == 'zoom' || (event.altKey || event.shiftKey)) {
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
				//Get the smoothed data and overlay
				if ($("#overlay").is(':checked')){
					//Force to remove Dygraph smoothing
					if ($('input[name="smooth"]').is(':checked')){
						g.updateOptions({rollPeriod: 1});
						$('input[name="smooth"]').attr('checked', false).attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
						$('input[name="smooth_val"]').parent().find('span').eq(1).html('(disabled to overlay)');
						$.ajax({
							url: '{{=URL("store_option")}}',
							data: {record_id:cur_id, var_name:'disp_smooth', val: $('input[name="smooth"]').is(':checked')},
							traditional: true
						});
					}
					$.ajax({
						url: '{{=URL('get_savgol.json')}}',
						data: {w:lochw,order:porder,deriv:0,data:JSON.stringify(data2derive)},
						traditional: true,
						type: 'POST',
						success: function(data){
							var result = data.result;
							//Shape data to plot
							var data2plot=[];
							var nS = graph_data[0].length;
							for (var iP=0; iP<graph_data.length;iP++){
								data2plot.push([graph_data[iP][0]]);//recopy time
								//recopy graph_data points
								for (var iS=1; iS<nS;iS++){
									data2plot[iP].push([graph_data[iP][iS]]);
								}
								//initialize to null
								for (var iS=1; iS<nS;iS++){
									data2plot[iP].push(null);
								}
							}
							var Tsamp=(graph_data[1][0]-graph_data[0][0]);
							var iIpass=0;
							for (var iI=0; iI<diffdataT.length; iI++){
								//prevent small intervals to be passed
								if (Math.ceil((diffdataT[iI][1]-diffdataT[iI][0])/Tsamp)<=(2*lochw+1)){
									iIpass++;
									continue;
								}
								//find index when graph_data[iP][0]==diffdataT[iI][0]
								for (iP=0; iP<graph_data.length;iP++){
									if (graph_data[iP][0]==diffdataT[iI][0]){break;}
								}
								//place values
								for (iS=0; iS<result[iI-iIpass].length;iS++){
									for (var iP2=0; iP2<result[iI-iIpass][iS].length;iP2++){
										data2plot[iP+iP2][iS+nS]=result[iI-iIpass][iS][iP2];
									}
								}
							}
							//Plot in g
							var colors = [];
							$('input[name="color"]').each(function(){
								colors.push($(this).val());
							});
							var labels = graph_labels.slice();
							for (var iS =  1; iS < nS; iS++) {
								colors.push("#000000");
								labels.push('SG0_'+graph_labels[iS]);
							};
							var vis = []
							$('input[name="show"]').each(function (){
								if ($(this).is(':checked')) vis.push(true);
								else vis.push(false);
							});
							g.updateOptions({ 
								file: data2plot,
								labels: labels,
								colors: colors,
								visibility: vis.concat(vis)
							});
						}
					});
				}
			});
			$('#preproc_close').unbind('click');
			$('#preproc_close').click(function(){
				$("#preproc_close").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
				$("#preproc").attr("value", "Extract, process and plot");
				g2 = undefined;
				$('#graphdiv2').hide();
				$('#graphdiv2:parent').html('<div id="graphdiv2"></div>');
				var colors = [];
				$('input[name="color"]').each(function(){
					colors.push($(this).val());
				});
				g.updateOptions({ 
					file: graph_data,
					labels: graph_labels,
					colors: colors
				});
				g.resize(window.innerWidth-510, (window.innerHeight-90));
				$('input[name="smooth_val"]').parent().find('span').eq(1).html('');
				$('input[name="smooth"]').removeAttr("disabled").removeAttr("style");
			});
			//Default button unabling
			$("#preproc_close").attr("disabled", "disabled").attr("style","color: rgb(170,170,170)");
		});
	});
}
/**************** REPLOT Graph after 'sampling time' update ************/
function updateGraph(series_name){
	simpleUpdate = function(){
		//Update colors
		var colors = [];
		$('input[name="color"]').each(function (){
			colors.push($(this).val());
		});
		g.updateOptions({'colors': colors});

	    //Update visibilities
		var visibilities = [];
		$('input[name="show"]').each(function (){
			visibilities.push($(this).is(':checked'));
		});
		g.updateOptions({'visibility': visibilities});

		//Update smoothingroller
		if ($('input[name="smooth"]').is(':checked')) g.updateOptions({rollPeriod: parseFloat($('input[name="smooth_val"]').val())});
	}

	//Update name
	$('#my_records > ul').find('#'+cur_id).find('.flise_select').html(series_name); 
	$(".current_record").html(series_name);
	//Load time-series and associated data, then display graph and initiate callbacks
	makeGraph(simpleUpdate);
}
/**************** PLOT Graph  ************/
function makeGraph(onsuccess){
	$.getJSON('{{=URL('get_data.json')}}/'+cur_id,function(data){
		//Load raw data
		graph_data = data.result;
		graph_time = data.timepoint;
		//Reset the global graph object "g"
		g = undefined;
		//Enforce closing of "g2"
		g2 = undefined;
		$('#graphdiv2').hide();
		$('#graphdiv2:parent').html('<div id="graphdiv2"></div>');
		//Verif if same name is used, and thus update series name in g, and eventually add number if same name for several series
		graph_labels = data.labels;
		graph_labels.splice(0,1);
		var listSim=[];
		var flag=false;
		var iL;
		for (var i=0; i<graph_labels.length-1; i++){
			//find if it belongs to one list of similarities
			flag=false;
			if (listSim != []){
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
				for (var j=i+1; j<graph_labels.length; j++){
					if (graph_labels[i]==graph_labels[j]){
						listSim[iL].push(j);
					}
				}
				//alter names with index so that graph labels are different
				if (listSim[iL].length>1){
					for (var j=0; j<listSim[iL].length; j++){
						graph_labels[listSim[iL][j]]=graph_labels[listSim[iL][j]]+j;
					}
				}
			}
		}
		graph_labels.splice(0,0,"Time");
		//Create "g": main series plot
		createGraph(graph_data, graph_labels);
		g.resize(window.innerWidth-510, (window.innerHeight-90));

		//Load segmentation variables
		cutT = (data.cutT != null)?JSON.parse(data.cutT):[]; //Array of time point
		nodiffT = (data.nodiffT != null)?JSON.parse(data.nodiffT):[]; //Array of Array([start,end])
		dropT = (data.dropT != null)?JSON.parse(data.dropT):[]; //Array of Array([start,end])
		eventT = (data.eventT != null)?JSON.parse(data.eventT):[]; //Array or list
		dataT = dataZones();
		//Initiate graph underlaycallback based on cutT, etc...
		g.updateOptions({ 
			underlayCallback: function(canvas, area, g) {
				var area = g.layout_.getPlotArea();
				var altColor = false;
				canvas.clearRect(area.x, area.y, area.w, area.h);
				//Draw drop intervals
				for (iD=0; iD<dropT.length; iD++) {
					drawInterval (g, canvas, dropT[iD][0], dropT[iD][1], [255,128,128]);
				}
				//Draw nodiff intervals
				for (iN=0; iN<nodiffT.length; iN++) {
					drawInterval (g, canvas, nodiffT[iN][0], nodiffT[iN][1], [128,255,128]);
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

		//Display events if they are some
		for (var iE=0; iE<data.events['id'].length; iE++) {
			//add it to g annotations
			if (data.events['series_id'][iE]==-1){
				for (var i = 0; i < g.colors_.length; i++) {
					g.annotations_.push({
						series: g.user_attrs_['labels'][i+1],
						xval: data.events['time'][iE],
						icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
						width: 16,
						height: 16,
						tickHeight: 2,
						text: data.events['type'][iE]
					});
				}
			} else {
				g.annotations_.push({
					series: data.events['series_name'][iE],
					xval: data.events['time'][iE],
					icon: '{{=URL(request.application, 'static/icons','mark-event.png')}}',
					width: 16,
					height: 16,
					tickHeight: 2,
					text: data.events['type'][iE]
				});
			}
		}
	    g.setAnnotations(g.annotations());
	    if (onsuccess!=undefined) onsuccess();	    
	});
}

/************* SELECTION TOOLS *********************/

function change_tool(tool_div) {
	var ids = ['tool_zoom', 'tool_cut', 'tool_nodiff', 'tool_drop', 'tool_event', 'tool_cancel', 'tool_export'];
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
	} else if (tool == 'nodiff') {
		dg_div.style.cursor = 'url(/flise/static/icons/cursor-nodiff.png) 1 30, auto';
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


window.onmouseup = finishSelect;

/* -----------------------------END JSCRIPT------------------------------- */
