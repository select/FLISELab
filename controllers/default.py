# -*- coding: utf-8 -*-
# this file is released under public domain and you can use without limitations

#########################################################################
## This is a samples controller
## - index is the default action of any application
## - user is required for authentication and authorization
## - download is for downloading files uploaded in the db (does streaming)
## - call exposes all registered services (none by default)
#########################################################################


def index():
    """
    example action using the internationalization operator T and flash
    rendered by views/default/index.html or views/generic.html
    """
    check_first_user()#check if the first users exits if not redirect to setup
    response.files.append(URL(request.application, 'static/dygraphs', 'dygraph-dev.js'))
    response.files.append(URL(request.application, 'static/html5slider', 'html5slider.js'))      # to REMOVE in the end
    response.files.append(URL(request.application, 'static/js', 'jquery.confirm.js'))
    response.files.append(URL(request.application, 'static/colorpicker', 'jquery.colorPicker.js'))
    response.files.append(URL(request.application, 'static/colorpicker', 'colorPicker.css'))
    response.files.append(URL(request.application, 'static/css', 'flise.css'))
    response.files.append(URL(request.application, 'static/js', 'jquery.simplemodal.1.4.3.min.js'))
    #response.files.append(URL(request.application, 'static/jquery-checkbox', 'jquery.checkbox.js'))
    #response.files.append(URL(request.application, 'static/jquery-checkbox', 'jquery.checkbox.css'))
    #import os
    #data = open(os.path.join(request.folder, 'private', 'FLISE', 'data.csv')).readlines()
    #data = '\\n'.join([l[:-1] for l in data])
    #return dict(data = data)
    return dict(data='')


def files():
    records = db(db.flise_file.id > 0).select()
    items = []
    for record in records:
        filename, file = db.flise_file.file.retrieve(record.file)
        items.append(LI(DIV(record.name if record.name else filename, _class="flise_select"), DIV(A(DIV('export', _class="flise_export"), _target="_blank", _href=URL(r=request, f='export_file', vars=dict(flise_id=record.id))), DIV('delete', _class="flise_del"), _class='flise_file_actions'), _class='flise_file', _id=record.id))
    return TAG[''](JS('init_files();'), UL(items, _id="flise_files"))


def file():
    sampling_time_old = None
    global execonsuccess
    execonsuccess = ''
    if request.vars.delr:
        #FIXME add authentication here
        del db.flise_file[int(request.vars.delr)]
        return ''

    def on_validate(form):
        global sampling_time_old
        sampling_time_old = db.flise_file[request.args(0)].sampling_time

    def on_accept(form):
        from gluon.contrib import simplejson
        global sampling_time_old
        global execonsuccess
        #update time of cutT, nodiffT, dropT and evenT when sampling time is changed + subintervals definition
        if float(form.vars.sampling_time)>0:
            sfactor = float(form.vars.sampling_time) / sampling_time_old
        else:
            sfactor = 1 #do nothing
        if sfactor != 1:
            dropT = [[x * sfactor for x in y] for y in simplejson.loads(db.flise_file[form.vars.id].dropT)] if (db.flise_file[form.vars.id].dropT != None) else []
            db.flise_file[form.vars.id].update_record(dropT=simplejson.dumps(dropT))
            cutT = [x * sfactor for x in simplejson.loads(db.flise_file[form.vars.id].cutT)] if (db.flise_file[form.vars.id].cutT != None) else []
            db.flise_file[form.vars.id].update_record(cutT=simplejson.dumps(cutT))
            nodiffT = [[x * sfactor for x in y] for y in simplejson.loads(db.flise_file[form.vars.id].nodiffT)] if (db.flise_file[form.vars.id].nodiffT != None) else []
            db.flise_file[form.vars.id].update_record(nodiffT=simplejson.dumps(nodiffT))
            eventT = [x * sfactor for x in simplejson.loads(db.flise_file[form.vars.id].eventT)] if (db.flise_file[form.vars.id].eventT != None) else []
            db.flise_file[form.vars.id].update_record(eventT=simplejson.dumps(eventT))
            for record in db(db.event.flise_file_id == form.vars.id).select():
                time = record.time * sfactor
                record.update_record(time=time)
            for record in db(db.subintervals.flise_file_id == form.vars.id).select():
                extract_time = record.extract_time
                str_time = extract_time.split(':')
                intStart = float(str_time[0]) * sfactor
                intEnd = float(str_time[1]) * sfactor
                extract_time = '%g:%g' % (intStart, intEnd)
                record.update_record(extract_time=extract_time)
            execonsuccess = 'updateGraph("%s");' % form.vars.name
        else:
            execonsuccess = 'web2py_ajax_page("GET","%s","","my_records"); $(".current_record").html("%s"); cur_id=%s; ' % (URL(r=request, f='files'), form.vars.name, form.vars.id)

    def on_accept_create(form):
        global execonsuccess
        #import time
        #from datetime import datetime
        #record = db.flise_file[form.vars.id]
        #filename, file = db.flise_file.file.retrieve(record.file)
        #record.update_record(created_on=datetime.fromtimestamp(os.path.getctime(os.path.join(request.folder,'uploads',record.file))))
        ##?-> http://stackoverflow.com/questions/946967/get-file-creation-time-with-python-on-mac
        #execonsuccess = 'web2py_ajax_page("GET","%s","","my_records"); web2py_component("%s","edit_record"); $(".current_record").html("%s"); cur_id=%s; initGraph(%s,"%s");' % (URL(r=request, f='files'), URL('file', args=form.vars.id), form.vars.name, form.vars.id, form.vars.id, form.vars.name)
        execonsuccess = 'web2py_ajax_page("GET","%s","","my_records");' % (URL(r=request, f='files'))

    if request.args(0):
        db.flise_file.file.readable, db.flise_file.file.writable = False, False
        form = crud.update(db.flise_file, request.args(0), onaccept=on_accept, onvalidation=on_validate, deletable=False)
        submit = form.element("input", _type="submit")
        submit["_value"] = "update"
    else:
        db.flise_file.created_on.readable, db.flise_file.created_on.writable = False, False
        form = crud.create(db.flise_file, onaccept=on_accept_create)
    return TAG[''](JS(execonsuccess) if execonsuccess else '', form)


def get_data():
    response.generic_patterns = ['html', 'json']
    record = db.flise_file[int(request.args(0))]
    filename, raw_file = db.flise_file.file.retrieve(record.file)
    import csv
    reader = list(csv.reader(raw_file, delimiter="\t"))
    csv_data = [[i * record.sampling_time] + [float(x) for x in line[:-1]] for i, line in enumerate(reader)]
    labels = record.series_species if record.series_species else ['Species%s' % i for i, x in enumerate(csv_data[0][1:])]
    timepoint = [line[-1] for line in reader]
    labels = ['Time'] + labels
    if request.extension == 'json':
        return dict(result=csv_data, labels=labels, timepoint=timepoint)
    #not really working so better not use it
    data = '\\n'.join([','.join([str(x) for x in line]) for line in csv_data])
    return data


def series_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]

    def get_defaults():
        filename, raw_file = db.flise_file.file.retrieve(record.file)
        import csv
        reader = list(csv.reader(raw_file, delimiter="\t"))
        num_series = len(reader[0]) - 1
        name = ['Species%s' % i for i in range(num_series)]
        slope = [None for i in range(num_series)]
        colors = ['#0000ff', '#ff0000', '#008000', '#ff6600', '#008080', '#333300']  # Default colors
        color = [colors[i] for i in range(min(num_series, len(colors)))] + [None for i in range(max(num_series - len(colors), 0))]
        show = ['true' for i in range(num_series)]
        return dict(name=name, color=color, show=show, num_series=num_series, slope=slope)
    defaults = get_defaults()
    name = record.series_species or defaults["name"]
    num_series = len(name) or defaults["num_series"]
    color = record.series_colors or defaults["color"]
    show = record.series_show or defaults["show"]
    #convert to boolean
    show_bool = [s in ['true', 'True', '1'] for s in show]
    slope = record.series_slope or defaults["slope"]
    return dict(name=name, color=color, show=show_bool, num_series=num_series, slope=slope)


def global_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]

    def get_defaults():
        strain = None  # 'BN-1???'
        comments = 'General description, or any particular problem with the series...'
        smooth = False
        smooth_value = 10
        OD = None
        dilution = 50
        cell_diameter = 4.5
        return dict(strain=strain, comments=comments, smooth=smooth, smooth_value=smooth_value, OD=OD, dilution=dilution, celld=cell_diameter)
    defaults = get_defaults()
    strain_id = record.strain_id or defaults["strain"]
    comments = record.comments or defaults["comments"]
    smooth = record.disp_smooth or defaults["smooth"]
    smooth_value = record.disp_smooth_value or defaults["smooth_value"]
    OD = record.optical_density or defaults["OD"]
    dilution = record.dilution_factor or defaults["dilution"]
    cell_diameter = record.cell_diameter or defaults["celld"]
    return dict(strain_id=strain_id, comments=comments, smooth=smooth, smooth_value=smooth_value, od=OD, dilution=dilution, celld=cell_diameter)


def autoseg_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]

    def get_defaults():
        autoseg_win = 25
        autoseg_fuse = 60
        return dict(autoseg_win=autoseg_win, autoseg_fuse=autoseg_fuse)
    defaults = get_defaults()
    autoseg_win = record.autoseg_win or defaults["autoseg_win"]
    autoseg_fuse = record.autoseg_fuse or defaults["autoseg_fuse"]
    return dict(autoseg_win=autoseg_win, autoseg_fuse=autoseg_fuse)


def sg_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]

    def get_defaults():
        sg_win = 60
        sg_order = 4
        sg_overlay = False
        return dict(sg_win=sg_win, sg_order=sg_order, sg_overlay=sg_overlay)
    defaults = get_defaults()
    sg_win = record.sg_win or defaults["sg_win"]
    sg_order = record.sg_order or defaults["sg_order"]
    sg_overlay = record.sg_overlay or defaults["sg_overlay"]
    return dict(sg_win=sg_win, sg_order=sg_order, sg_overlay=sg_overlay)


def species():
    records = db(db.flise_file.id > 0).select(db.flise_file.series_species)
    species = set()
    for record in records:
        if record.series_species:
            for species_item in record.series_species:
                species.add(species_item)
    return SELECT([OPTION('')] + [OPTION(x, _value=x) for x in species], _name="select_species", _style="width:100px")


def components():
    species = set()
    species.add('* Studied organisms')
    records = db(db.flise_file.id > 0).select(db.flise_file.series_species)
    for record in records:
        if record.series_species:
            for species_item in record.series_species:
                species.add(species_item)
    records = db(db.solution.id > 0).select(db.solution.components_name)
    for record in records:
        if record.components_name:
            for species_item in record.components_name:
                species.add(species_item)
    #sortedspecies = sorted(species, key=lambda item: (int(item.partition(' ')[0]) if item[0].isdigit() else float('inf'), item))
    import re
    convert = lambda text: int(text) if text.isdigit() else text 
    alphanum_key = lambda key: [ convert(c) for c in re.split('([0-9]+)', key) ]
    sortedspecies = sorted(species, key = alphanum_key)
    return SELECT([OPTION('')] + [OPTION(x, _value=x) for x in sortedspecies], _name="select_components", _style="width:120px")


def strains():
    return SELECT([OPTION('')] + [OPTION(record.name, _value=record.id) for record in db(db.strain.id > 0).select()], _name="select_strain", _style="width:150px")


def solutions():
    return SELECT([OPTION('')] + [OPTION(record.name, _value=record.id) for record in db(db.solution.id > 0).select()], _name="select_solution", _style="width:150px")


def store_option():
    response.generic_patterns = ['html', 'json']
    record_id = request.vars.record_id
    var_name = request.vars.var_name
    if request.vars.val:
        val = request.vars.val
        if 'series_' in var_name:
            if type(val)==str:
                val = [val]
        db.flise_file[int(record_id)].update_record(**{var_name: val})
    if request.extension == 'json':
        from gluon.contrib import simplejson
        return simplejson.dumps(getattr(db.flise_file[int(record_id)], var_name))
    else:
        return getattr(db.flise_file[int(record_id)], var_name)


def store_strain():
    record_id = request.vars.record_id
    if request.vars.val:
        db.flise_file[int(record_id)].update_record(strain_id=request.vars.val)


def store_subint_option():
    response.generic_patterns = ['json']
    from gluon.contrib import simplejson
    flise_record_id = request.vars.flise_record_id
    interval_time = request.vars.interval_time
    record = db(db.subintervals.extract_time == interval_time)(db.subintervals.flise_file_id == flise_record_id).select().first()
    if request.vars.var_name:
        var_name = request.vars.var_name
        val = request.vars.val
        if var_name in ['slope', 'intercept']:
            if type(val)==str:
                val = [val]
        if record:
            record.update_record(**{var_name: val})
        else:
            record = db.subintervals.insert(flise_file_id=flise_record_id, extract_time=interval_time)
            record.update_record(**{var_name: val})
    if record:
        return simplejson.dumps(dict([(field, record[field]) for field in db.subintervals.fields]))
    else:
        return dict()


def del_subint():
    response.generic_patterns = ['json']
    flise_record_id = request.vars.flise_record_id
    interval_time = request.vars.interval_time
    sel_set = db(db.subintervals.extract_time == interval_time)(db.subintervals.flise_file_id == flise_record_id)
    if sel_set:
        sel_set.delete()


def store_event():
    response.generic_patterns = ['json']
    flise_record_id = request.vars.flise_record_id
    time = float(request.vars.time)
    series_id = int(request.vars.series_id)
    record = db(db.event.time == time)(db.event.flise_file_id == flise_record_id)(db.event.series_id == series_id).select().first()
    if request.vars.var_name:
        var_name = request.vars.var_name
        val = request.vars.val
        if record:
            record.update_record(**{var_name: val})
        else:
            record = db.event.insert(flise_file_id=flise_record_id, time=time, series_id=series_id)
            record.update_record(**{var_name: val})
    if record:
        return dict([(field, record[field]) for field in db.event.fields])
    else:
        return dict()


def del_event():
    response.generic_patterns = ['json']
    flise_record_id = request.vars.flise_record_id
    time = float(request.vars.time)
    series_id = int(request.vars.series_id)
    sel_set = db(db.event.time == time)(db.event.flise_file_id == flise_record_id)(db.event.series_id == series_id)
    if sel_set:
        sel_set.delete()


def store_solution():
    response.generic_patterns = ['json']
    if request.vars.solution_id:
        solution_id = request.vars.solution_id
        record = db(db.solution.id == solution_id).select().first()
    else:
        record = None
    if request.vars.var_name:
        var_name = request.vars.var_name
        if var_name != 'name':
            val = request.vars.getlist('val')
        else:
            val = request.vars.val
        if record:
            record.update_record(**{var_name: val})
        else:
            record = db.solution.insert(**{var_name: val})
    if record:
        if request.vars.solution_id:
            #check if it is used in any other event whatever series
            if db(db.event.solution_id == solution_id).count() > 1:
                flag_unique = False
            else:
                flag_unique = True
            return dict([(field, record[field]) for field in db.solution.fields] + [('flagUnique', flag_unique)])
        else:
            return dict([(field, record[field]) for field in db.solution.fields] + [('flagUnique', True)])
    else:
        return dict()


def del_solution():
    response.generic_patterns = ['json']
    solution_id = request.vars.solution_id
    flise_file_id = request.vars.flise_file_id
    time = float(request.vars.time)
    series_id = int(request.vars.series_id)
    #check if it is not used in any other event whatever series
    if db(db.event.solution_id == solution_id).count() == db(db.event.solution_id == solution_id)(db.event.flise_file_id == flise_file_id)(db.event.time == time)(db.event.series_id == series_id).count():
        sel_set = db(db.event.solution_id == solution_id)(db.event.flise_file_id == flise_file_id)(db.event.time == time)(db.event.series_id == series_id)
        if sel_set:
            sel_set.delete()
        sel_set = db(db.solution.id == solution_id)
        if sel_set:
            sel_set.delete()
        series_name = []
        sel_set = db(db.event.flise_file_id == flise_file_id)(db.event.time == time)
        if sel_set:
            for record in sel_set.select():
                series_name.append(record.series_name)
            return {"acceptDel": True, "series_name": series_name}
        else:
            return {"acceptDel": True, "series_name": []}
    else:
        return {"acceptDel": False}


def get_savgol():
    response.generic_patterns = ['json']
    import savgol
    myinstance = savgol.Savgol(int(request.vars.w), int(request.vars.w), int(request.vars.order), int(request.vars.deriv))
    from gluon.contrib import simplejson
    data2derive = simplejson.loads(request.vars.data)
    result = []
    for iI in range(len(data2derive)):
        result.append([])
        for iS in range(len(data2derive[iI])):
            result[iI].append(myinstance.filterTS(data2derive[iI][iS]))
    return dict(result=result)


def subint_process_data():
    response.generic_patterns = ['json']
    flise_file_id = request.vars.flise_file_id
    interval_time = request.vars.interval_time
    time = interval_time.split(':')
    intStart = float(time[0])
    intEnd = float(time[1])
    #load interval parameters
    sel_set = db(db.subintervals.extract_time == interval_time)(db.subintervals.flise_file_id == flise_file_id)
    record = sel_set.select().first()
    optical_density = record.optical_density
    dilution_factor = record.dilution_factor
    cell_diameter = record.cell_diameter * 1e-6
    slope = record.slope
    intercept = record.intercept
    #calculate concentrations
    from gluon.contrib import simplejson
    data = simplejson.loads(request.vars.data)
    data2diff = []
    from math import pi, ceil
    vsr = ((1 - optical_density * 1.2e7 * dilution_factor * (4 / 3) * pi * ((cell_diameter / 2) ** 3)) / (optical_density * 1.2e7 * dilution_factor * pi * (cell_diameter ** 2)))
    for iS in range(len(data)):
        data2diff.append([10 ** ((x - float(intercept[iS])) / float(slope[iS])) for x in data[iS]])
    #differentiate interval raw data
    import savgol
    record = db.flise_file[int(flise_file_id)]
    sg_win = record.sg_win
    sg_order = record.sg_order
    ts = float(record.sampling_time)
    SG0 = savgol.Savgol(int(sg_win), int(sg_win), int(sg_order), 0)
    SG1 = savgol.Savgol(int(sg_win), int(sg_win), int(sg_order), 1)
    diffT = simplejson.loads(request.vars.interval_diff)
    datadiff = []
    datasmooth = []
    for iS in range(len(data2diff)):
        if len(diffT) == 0:
            datadiff.append([None for x in range(len(data2diff[iS]))])
        else:
            seriesdiff = []
            series2diff = []
            seriessmooth = []
            iD = 0
            flag = True
            for iP in range(len(data2diff[iS])):
                if ((intStart + iP * ts) >= diffT[iD][0]) and ((intStart + iP * ts) <= diffT[iD][1]) and (ceil((diffT[iD][1] - diffT[iD][0]) / ts) > (2 * int(sg_win) + 1)):
                    series2diff.append(data2diff[iS][iP])
                    flag = True
                else:
                    if flag:
                        flag = False
                        if len(series2diff) != 0:
                            seriesdiff.extend(SG1.filterTS(series2diff))
                            seriessmooth.extend(SG0.filterTS(series2diff))
                        series2diff = []
                        if iD < len(diffT) - 1:
                            iD = iD + 1
                    seriesdiff.append(None)
                    seriessmooth.append(None)
            if flag:
                seriesdiff.extend(SG1.filterTS(series2diff))
                seriessmooth.extend(SG0.filterTS(series2diff))
            datadiff.append([x / ts if x is not None else None for x in seriesdiff])
            datasmooth.append([x if x is not None else None for x in seriessmooth])
    fluxes = []
    for iS in range(len(datadiff)):
        fluxes.append([-1e6 * vsr * x if x is not None else None for x in datadiff[iS]])  # m^3 m^-2 s^-1 mol L^-1 = 10^6 m s^-1 nmol m^-2 and influx is positive
    #collect events and solutions and calculate volume sequence
    intEvents = []
    intSolutions = []
    volume = []
    ncell = []
    sel_set = db(db.event.flise_file_id == flise_file_id)
    eventStart = -1
    if sel_set:
            #find where to start
            for record in sel_set.select():
                if float(record.time) <= intStart and record.type == 'wash':
                    eventStart = max(eventStart, float(record.time))
            #collect events
            intSols_index = set()
            for record in sel_set.select():
                if eventStart <= float(record.time) < intEnd:
                    intEvents.append({'time': float(record.time), 'type': record.type, 'series_name': record.series_name, 'solution_name': db.solution[record.solution_id].name if record.solution_id else None, 'concentration': record.concentration, 'volume': record.volume, 'comment': record.comment})
                    if record.solution_id:
                        intSols_index.add(record.solution_id)
            from operator import itemgetter
            intEvents = sorted(intEvents, key=itemgetter('time'))
            #collect solutions
            for iS in intSols_index:
                solution_record = db.solution[int(iS)]
                if solution_record:
                    intSolutions.append({'name': solution_record.name, 'components_name': solution_record.components_name, 'components_ratio': solution_record.components_ratio})
            #make volume sequence
            volume_step = []
            number_cell_step = []
            volume_time = []
            volume_now = 0
            number_now_cell = 0
            for intEvent in intEvents:
                flagcell = False
                for intSolution in intSolutions:
                    if intEvent['solution_name'] == intSolution['name']:
                        if '* Studied organisms' in intSolution['components_name']:
                            flagcell = True
                            break
                if intEvent['type'] == 'wash':
                    volume_now = float(intEvent['volume'])
                    if flagcell:
                        number_now_cell = float(intEvent['volume']) * 1000 * optical_density * 1.2e7 * dilution_factor #only if the initial solution contains cells
                    else:
                        number_now_cell = 0
                elif intEvent['type'] == 'dilution':
                    volume_now = volume_now + float(intEvent['volume'])
                elif intEvent['type'] == 'removal':
                    number_now_cell = number_now_cell * (1 - float(intEvent['volume']) / volume_now)
                    volume_now = volume_now - float(intEvent['volume'])
                elif intEvent['type'] == 'injection':
                    volume_now = volume_now + float(intEvent['volume'])
                    if flagcell:
                        number_now_cell = number_now_cell + float(intEvent['volume']) * 1000 * optical_density * 1.2e7 * dilution_factor #only if the injected solution contains cells
                volume_step.append(volume_now)
                number_cell_step.append(number_now_cell)
                volume_time.append(intEvent['time'])
            if len(volume_step) == 0:
                volume_step.append(0)
                number_cell_step.append(0)
                volume_time.append(intStart)
            volume_time.append(intEnd)
            t = intStart
            for iv, tv in enumerate(volume_time):
                if tv <= intStart:
                    volume_index = iv
                else:
                    break                
            while (t < intEnd):
                if volume_time[volume_index + 1] <= t:
                    volume_index += 1
                volume.append(volume_step[volume_index])
                ncell.append(number_cell_step[volume_index])
                t = t + ts
            volume.append(volume_step[volume_index])
            ncell.append(number_cell_step[volume_index])
    return dict(concentrations=data2diff, concentrationsSmooth=datasmooth, concentrationsDiff=datadiff, fluxes=fluxes, volume=volume, ncell=ncell, surf2vol_ratio=vsr, intEvents=intEvents, intSolutions=intSolutions)


def export_spreadsheet():
    export_format = request.vars.format
    from gluon.contrib import simplejson
    try:
        data_object = simplejson.loads(request.vars.data)
    except:
        import sys
        raise HTTP(500, 'Deserializing JSON input failed: %s' % sys.exc_info()[1])
    import tablib.core
    databook = tablib.core.Databook()
    for name, data in data_object:
        #print 'not using transmitted data header: ',data['header']
        if False and data['header']:
            dataset = tablib.core.Dataset(headers=data['header'])
        else:
            dataset = tablib.core.Dataset(headers=data['header'])
            dataset.title = name
        for row in data['data']:
            if row:
                dataset.append(row)
        #dataset.extend(data['data'])
        databook.add_sheet(dataset)
    if export_format == 'store_xls':
        from gluon.utils import web2py_uuid
        import os
        uufilename = web2py_uuid() + '.xls'
        if not os.path.exists(os.path.join(request.folder, 'static', 'tmp')):
            os.mkdir(os.path.join(request.folder, 'static', 'tmp'))
        open(os.path.join(request.folder, 'static', 'tmp',  uufilename), 'wb').write(getattr(databook, 'xls'))
        return URL(request.application, 'static/tmp', uufilename)
    elif export_format in 'yaml csv xls xlsx':
        import gluon.contenttype
        response.headers['Content-Type'] = gluon.contenttype.contenttype('.%s' % export_format)
        response.headers['Content-disposition'] = 'attachment; filename=%s.%s' % (request.vars.filename, export_format)
        return getattr(databook, export_format)
    return ''


def export_file():
    cur_id = request.vars.flise_id
    import zipfile
    import StringIO
    import os.path
    output = StringIO.StringIO()
    archive = zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED)
    archive.write(os.path.join(request.folder, 'uploads', db.flise_file[cur_id].file), arcname="file.txt")
    archive.write(os.path.join(request.folder, 'uploads', db.flise_file[cur_id].rlvfile), arcname="file.rlv")
    archive.writestr("flise_file.csv", str(db(db.flise_file.id == cur_id).select()))
    archive.writestr("events.csv", str(db(db.event.flise_file_id == cur_id).select()))
    archive.writestr("subintervals.csv", str(db(db.subintervals.flise_file_id == cur_id).select()))
    archive.writestr("solutions.csv", str(db(db.solution.id == db.event.solution_id)(db.event.flise_file_id == cur_id).select(db.solution.id, db.solution.name, db.solution.components_name, db.solution.components_ratio, distinct=True)))
    archive.writestr("strains.csv", str(db(db.strain.id == db.flise_file.strain_id)(db.flise_file.id == cur_id).select(db.strain.id, db.strain.name, db.strain.identifier)|db(db.strain.id == db.subintervals.strain_id)(db.subintervals.flise_file_id == cur_id).select(db.strain.id, db.strain.name, db.strain.identifier, distinct=True)))
    archive.close()
    if request.extension == 'store_zip':
        from gluon.utils import web2py_uuid
        uufilename = web2py_uuid() + '.zip'
        if not os.path.exists(os.path.join(request.folder, 'static', 'tmp')):
            os.mkdir(os.path.join(request.folder, 'static', 'tmp'))
        open(os.path.join(request.folder, 'static', 'tmp',  uufilename), 'wb').write(output.getvalue())
        return URL(request.application, 'static/tmp', uufilename)
    import gluon.contenttype
    response.headers['Content-Type'] = gluon.contenttype.contenttype('.zip')
    response.headers['Content-disposition'] = 'attachment; filename=flise_file_%s.zip' % cur_id
    return output.getvalue()


def export_pyMantis():
    cur_id = request.vars.flise_id
    #make excel
    from gluon.contrib import simplejson
    try:
        data_object = simplejson.loads(request.vars.data)
    except:
        import sys
        raise HTTP(500, 'Deserializing JSON input failed: %s' % sys.exc_info()[1])
    import tablib.core
    databook = tablib.core.Databook()
    for name, data in data_object:
        if False and data['header']:
            dataset = tablib.core.Dataset(headers=data['header'])
        else:
            dataset = tablib.core.Dataset(headers=data['header'])
            dataset.title = name
        for row in data['data']:
            if row:
                dataset.append(row)
        databook.add_sheet(dataset)
    export_format = 'xls'
    #make zipfile
    import zipfile
    import StringIO
    import os.path
    fexport = StringIO.StringIO()
    fexport.write(getattr(databook, export_format))
    output = StringIO.StringIO()
    archive = zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED)
    archive.writestr('%s.%s' % (request.vars.filename, export_format), fexport.getvalue())
    fexport.close()
    archive.write(os.path.join(request.folder, 'uploads', db.flise_file[cur_id].file), arcname="file.txt")
    archive.write(os.path.join(request.folder, 'uploads', db.flise_file[cur_id].rlvfile), arcname="file.rlv")
    archive.writestr("flise_file.csv", str(db(db.flise_file.id == cur_id).select()))
    archive.writestr("events.csv", str(db(db.event.flise_file_id == cur_id).select()))
    archive.writestr("subintervals.csv", str(db(db.subintervals.flise_file_id == cur_id).select()))
    archive.writestr("solutions.csv", str(db(db.solution.id == db.event.solution_id)(db.event.flise_file_id == cur_id).select(db.solution.id, db.solution.name, db.solution.components_name, db.solution.components_ratio, distinct=True)))
    archive.writestr("strains.csv", str(db(db.strain.id == db.flise_file.strain_id)(db.flise_file.id == cur_id).select(db.strain.id, db.strain.name, db.strain.identifier)|db(db.strain.id == db.subintervals.strain_id)(db.subintervals.flise_file_id == cur_id).select(db.strain.id, db.strain.name, db.strain.identifier, distinct=True)))
    archive.close()
    #return zipfile
    import gluon.contenttype
    response.headers['Content-Type'] = gluon.contenttype.contenttype('.zip')
    response.headers['Content-disposition'] = 'attachment; filename=%s_export-flise-%s.zip' % (request.vars.filename, cur_id)
    return output.getvalue()


def import_file():
    flag = True
    if request.vars.datafile != None:
        flise_file_zip = request.vars.datafile.file
        import zipfile
        if zipfile.is_zipfile(flise_file_zip):
            zf = zipfile.ZipFile(flise_file_zip, 'r')
            for filename in ['flise_file.csv', 'events.csv', 'subintervals.csv', 'solutions.csv', 'file.txt', 'file.rlv']:
                try:
                    zf.getinfo(filename)
                except KeyError:
                    flag = False
            if flag:
                import csv
                #strains
                file_strains = csv.DictReader(zf.read('strains.csv').split('\r\n'))
                strain_newindex = []
                for strain in file_strains:
                    strain_newindex.append([strain['strain.id']])
                    del strain['strain.id']
                    strain = dict((key.replace('strain.', ''), value) for (key, value) in strain.items())
                    if not db(db.strain.name == strain['name'])(db.strain.identifier == strain['identifier']).count():
                        db_strain = db.strain.insert(**strain)
                    else:
                        db_strain = db(db.strain.name == strain['name'])(db.strain.identifier == strain['identifier']).select().first()
                    strain_newindex[-1].append(db_strain.id)
                strain_newindex = dict((x[0], x[1]) for x in strain_newindex)
                #flise
                file_flise = csv.DictReader(zf.read('flise_file.csv').split('\r\n')).next()
                del file_flise['flise_file.id']
                del file_flise['flise_file.file']
                file_flise = dict((key.replace('flise_file.', ''), value if value != '<NULL>' else None) for (key, value) in file_flise.items())
                file_flise['series_species'] = [x for x in file_flise['series_species'].split('|')[1:-1]] if file_flise['series_species'] != None else None
                file_flise['series_show'] = [x for x in file_flise['series_show'].split('|')[1:-1]] if file_flise['series_show'] != None else None
                file_flise['series_slope'] = [x for x in file_flise['series_slope'].split('|')[1:-1]] if file_flise['series_slope'] != None else None
                file_flise['series_colors'] = [x for x in file_flise['series_colors'].split('|')[1:-1]] if file_flise['series_colors'] != None else None
                file_flise['strain_id'] = strain_newindex[file_flise['strain_id']] if file_flise['strain_id'] != None else None
                file_data = db.flise_file.file.store(zf.open('file.txt'))
                file_flise['file'] = file_data
                rlvfile_data = db.flise_file.rlvfile.store(zf.open('file.rlv'))
                file_flise['rlvfile'] = rlvfile_data
                db_flise_file = db.flise_file.insert(**file_flise)
                #solutions
                file_solutions = csv.DictReader(zf.read('solutions.csv').split('\r\n'))
                solution_newindex = []
                for solution in file_solutions:
                    solution_newindex.append([solution['solution.id']])
                    del solution['solution.id']
                    solution = dict((key.replace('solution.', ''), value if value != '<NULL>' else None) for (key, value) in solution.items())
                    solution['components_name'] = [x for x in solution['components_name'].split('|')[1:-1]] if solution['components_name'] != None else None
                    solution['components_ratio'] = [x for x in solution['components_ratio'].split('|')[1:-1]] if solution['components_ratio'] != None else None
                    db_solution = db(db.solution.name == solution['name'])(db.solution.components_name == solution['components_name'])(db.solution.components_ratio == solution['components_ratio']).select().first()
                    if not db_solution:
                        db_solution = db.solution.insert(**solution)
                    solution_newindex[-1].append(db_solution.id)
                solution_newindex = dict((x[0], x[1]) for x in solution_newindex)
                #events
                file_events = csv.DictReader(zf.read('events.csv').split('\r\n'))
                event_newindex = []
                for event in file_events:
                    event_newindex.append([event['event.id']])
                    del event['event.id']
                    event = dict((key.replace('event.', ''), value if value != '<NULL>' else None) for (key, value) in event.items())
                    event['flise_file_id'] = db_flise_file.id
                    event['solution_id'] = solution_newindex[event['solution_id']] if event['solution_id'] != None else None
                    db_event = db.event.insert(**event)
                    event_newindex[-1].append(db_event.id)
                #subintervals
                file_subintervals = csv.DictReader(zf.read('subintervals.csv').split('\r\n'))
                subint_newindex = []
                for subint in file_subintervals:
                    subint_newindex.append([subint['subintervals.id']])
                    del subint['subintervals.id']
                    subint = dict((key.replace('subintervals.', ''), value if value != '<NULL>' else None) for (key, value) in subint.items())
                    subint['flise_file_id'] = db_flise_file.id
                    subint['slope'] = [x for x in subint['slope'].split('|')[1:-1]] if subint['slope'] != None else None
                    subint['intercept'] = [x for x in subint['intercept'].split('|')[1:-1]] if subint['intercept'] != None else None
                    subint['strain_id'] = strain_newindex[subint['strain_id']] if subint['strain_id'] != None else None
                    db_subint = db.subintervals.insert(**subint)
                    subint_newindex[-1].append(db_subint.id)
            zf.close()
        else:
            flag = False
    from gluon.sqlhtml import form_factory
    form = form_factory(Field('datafile', 'upload', label='or import "Flise*.zip"', uploadfield=False))
    return TAG[''](JS('web2py_ajax_page("GET", "%s", "", "my_records");' % URL(r=request, f='files')) if flag else '', form if flag else TAG[''](DIV('Wrong file, cannot load.', _style='color:red'), form))


def user():
    """
    exposes:
    http://..../[app]/default/user/login
    http://..../[app]/default/user/logout
    http://..../[app]/default/user/register
    http://..../[app]/default/user/profile
    http://..../[app]/default/user/retrieve_password
    http://..../[app]/default/user/change_password
    use @auth.requires_login()
        @auth.requires_membership('group name')
        @auth.requires_permission('read','table name',record_id)
    to decorate functions that need access control
    """
    return dict(form=auth())


def download():
    """
    allows downloading of uploaded files
    http://..../[app]/default/download/[filename]
    """
    return response.download(request, db)


def call():
    """
    exposes services. for example:
    http://..../[app]/default/call/jsonrpc
    decorate with @services.jsonrpc the functions to expose
    supports xml, json, xmlrpc, jsonrpc, amfrpc, rss, csv
    """
    return service()


@auth.requires_signature()
def data():
    """
    http://..../[app]/default/data/tables
    http://..../[app]/default/data/create/[table]
    http://..../[app]/default/data/read/[table]/[id]
    http://..../[app]/default/data/update/[table]/[id]
    http://..../[app]/default/data/delete/[table]/[id]
    http://..../[app]/default/data/select/[table]
    http://..../[app]/default/data/search/[table]
    but URLs bust be signed, i.e. linked with
      A('table',_href=URL('data/tables',user_signature=True))
    or with the signed load operator
      LOAD('default','data.load',args='tables',ajax=True,user_signature=True)
    """
    return dict(form=crud())
