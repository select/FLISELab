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
    response.files.append(URL(request.application, 'static/js', 'jquery.simplemodal.1.4.1.min.js'))
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
        items.append(LI(DIV(record.name if record.name else filename, _class="select"), DIV('delete', _class="del"), _class='flise_file', _id=record.id))
    return TAG[''](JS('init_files();'), UL(items, _id="flise_files"))


def file():
    sampling_time_old = None
    if request.vars.delr:
        #FIXME add authentication here
        del db.flise_file[int(request.vars.delr)]
        return ''

    def on_validate(form):
        global sampling_time_old
        sampling_time_old = db.flise_file[request.args(0)].sampling_time
        print '1 asdf asdf', request.args(0), sampling_time_old

    def on_accept(form):
        from gluon.contrib import simplejson
        global sampling_time_old
        #update time of cutT, nocutT, dropT and evenT when sampling time is changed + subintervals definition
        print '2 asdfsdddd ', form.vars.sampling_time, sampling_time_old
        sfactor = form.vars.sampling_time / sampling_time_old
        dropT = [[x * sfactor for x in y] for y in simplejson.loads(db.flise_file[form.vars.id].dropT)]
        db.flise_file[form.vars.id].update_record(dropT=simplejson.dumps(dropT))
        cutT = [x * sfactor for x in simplejson.loads(db.flise_file[form.vars.id].cutT)]
        db.flise_file[form.vars.id].update_record(cutT=simplejson.dumps(cutT))
        nocutT = [[x * sfactor for x in y] for y in simplejson.loads(db.flise_file[form.vars.id].nocutT)]
        db.flise_file[form.vars.id].update_record(nocutT=simplejson.dumps(nocutT))
        eventT = [x * sfactor for x in simplejson.loads(db.flise_file[form.vars.id].eventT)]
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
        response.headers['web2py-component-command'] = 'web2py_ajax_page("GET","%s","","my_records"); $(".current_record").html("%s"); cur_id=%s; init_file(%s,"%s");' % (URL(r=request, f='files'), form.vars.name, form.vars.id, form.vars.id, form.vars.name)

    def on_accept_create(form):
        #import time
        #from datetime import datetime
        #record = db.flise_file[form.vars.id]
        #filename, file = db.flise_file.file.retrieve(record.file)
        #record.update_record(created_on=datetime.fromtimestamp(os.path.getctime(os.path.join(request.folder,'uploads',record.file))))
        ##?-> http://stackoverflow.com/questions/946967/get-file-creation-time-with-python-on-mac
        response.headers['web2py-component-command'] = 'web2py_ajax_page("GET","%s","","my_records"); web2py_component("%s","edit_record"); $(".current_record").html("%s"); cur_id=%s; init_file(%s,"%s");'  \
                                                                                                % (URL(r=request, f='files'), URL('file', args=form.vars.id), form.vars.name, form.vars.id, form.vars.id, form.vars.name)

    if request.args(0):
        db.flise_file.file.readable, db.flise_file.file.writable = False, False
        form = crud.update(db.flise_file, request.args(0), onaccept=on_accept, onvalidation=on_validate, deletable=False)
        submit = form.element("input", _type="submit")
        submit["_value"] = "update"
    else:
        db.flise_file.created_on.readable, db.flise_file.created_on.writable = False, False
        form = crud.create(db.flise_file, onaccept=on_accept_create)
    return TAG[''](JS(response.headers['web2py-component-command']) if 'web2py-component-command' in response.headers else '', form)


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
        #color = None
        colors = ['#0000ff', '#ff0000', '#008000', '#ff6600', '#008080', '#333300']  # Default colors
        color = [colors[i] for i in range(min(num_series, len(colors)))] + [None for i in range(max(num_series - len(colors), 0))]
        show = ['true' for i in range(num_series)]
        return dict(name=name, color=color, show=show, num_series=num_series)
    defaults = get_defaults()
    name = record.series_species or defaults["name"]
    num_series = len(name) or defaults["num_series"]
    color = record.series_colors or defaults["color"]
    show = record.series_show or defaults["show"]
    #convert to boolean
    show_bool = [s in ['true', 'True', '1'] for s in show]
    return dict(name=name, color=color, show=show_bool, num_series=num_series)


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
        sg_win = 40
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
    return SELECT([OPTION('')] + [OPTION(x, _value=x) for x in species], _name="select_components", _style="width:120px")


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
        if var_name != ' name':
            val = request.vars.getlist('val')
        else:
            val = request.vars.val
        if record:
            record.update_record(**{var_name: val})
        else:
            record = db.solution.insert(**{var_name: val})
            #record.update_record(**{var_name: val})
    if record:
        return dict([(field, record[field]) for field in db.solution.fields])
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
    cell_diameter = record.cell_diameter
    slope = record.slope
    intercept = record.intercept
    #calculate concetrations
    from gluon.contrib import simplejson
    data = simplejson.loads(request.vars.data)
    data2diff = []
    for iS in range(len(data)):
        data2diff.append([10 ** ((x - float(intercept[iS])) / float(slope[iS])) for x in data[iS]])
    #differentiate interval raw data
    import savgol
    record = db.flise_file[int(flise_file_id)]
    sg_win = record.sg_win
    sg_order = record.sg_order
    myinstance = savgol.Savgol(int(sg_win), int(sg_win), int(sg_order), 1)
    datadiff = []
    for iS in range(len(data2diff)):
        datadiff.append(myinstance.filterTS(data2diff[iS]))
    #collect events and solutions and calculate volume sequence
    intEvents = []
    intSolutions = []
    volume = []
    ncell = []
    ts = float(record.sampling_time)
    sel_set = db(db.event.flise_file_id == flise_file_id)
    eventStart = -1
    if sel_set:
            #find where to start
            for record in sel_set.select():
                if float(record.time) <= intStart and record.type == 'wash':
                    eventStart = max(eventStart, float(record.time))
            #collect events
            for record in sel_set.select():
                if eventStart <= float(record.time) < intEnd:
                    intEvents.append({'time': float(record.time), 'type': record.type, 'series_name': record.series_name, 'solution_id': record.solution_id, 'concentration': record.concentration, 'volume': record.volume, 'comment': record.comment})
            from operator import itemgetter
            intEvents = sorted(intEvents, key=itemgetter('time'))
            intSols_index = set()
            for intEvent in intEvents:
                intSols_index.add(intEvent['solution_id'])
            #collect solutions
            for iS in intSols_index:
                record = db.solution.id[int(iS)]
                intSolutions.append({'name': record.name, 'components_name': record.components_name, 'components_ratio': record.components_ratio})
            #make volume sequence
            volume_step = []
            volume_time = []
            volume_now = 0
            for intEvent in intEvents:
                if intEvent['type'] == 'wash':
                    volume_now = float(intEvent['volume'])
                elif intEvent['type'] == 'dilution':
                    volume_now = volume_now + float(intEvent['volume'])
                elif intEvent['type'] == 'removal':
                    volume_now = volume_now - float(intEvent['volume'])
                elif intEvent['type'] == 'injection':
                    volume_now = volume_now + float(intEvent['volume'])
                volume_step.append(volume_now)
                volume_time.append(intEvent['time'])
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
                ncell.append(volume_step[volume_index] * optical_density * 1.2e7 * dilution_factor)
                t = t + ts
    return dict(concentrations=data2diff, concentrationsDiff=datadiff, volume=volume, ncell=ncell, intEvents=intEvents, intSolutions=intSolutions)


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
    for name, data in data_object.iteritems():
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
    if export_format in 'yaml csv xls xlsx':
        import gluon.contenttype
        #import os.path
        response.headers['Content-Type'] = gluon.contenttype.contenttype('.%s' % export_format)
        response.headers['Content-disposition'] = 'attachment; filename=%s.%s' % (request.vars.filename, export_format)
        #response.write(getattr(data,export_format), escape=False)
        return getattr(databook, export_format)
    return ''


def export():
    # def compress(path, archive, base_path, archive_type = 'zip'):
    #     paths = os.listdir(path)
    #     for p in paths:
    #         p = os.path.join(path, p) # Make the path relative
    #         if os.path.isdir(p): # Recursive case
    #             compress(p, archive, base_path, archive_type)
    #         else:
    #             if archive_type == 'zip':
    #                 archive.write(p, './'+p[len(base_path):]) # Write the file to the zipfile
    #             elif archive_type == 'tar':
    #                 archive.add(p, './'+p[len(base_path):], False, glob_ignore)
    #     return

    # def targzit(path, archname):
    #     tarname = os.path.join(path, archname[:-7] + '.tar')
    #     archive = tarfile.TarFile(tarname, 'w')
    #     if os.path.isdir(path):
    #         compress(path, archive, path, 'tar')
    #     else:
    #         archive.add(p, './'+p[len(base_path):])
    #     archive.close()

    #     tgzfp = gzopen(archname, 'wb')
    #     tfp = open(tarname, 'rb')
    #     tgzfp.write(tfp.read())
    #     tfp.close()
    #     tgzfp.close()
    #     #os.unlink(tarname)

    # def zipit(path, archname):
    #     # Create a ZipFile Object primed to write
    #     archive = zipfile.ZipFile(archname, "w", zipfile.ZIP_DEFLATED) # "a" to append, "r" to read
    #     # Recurse or not, depending on what path is
    #     if os.path.isdir(path):
    #         compress(path, archive, path)
    #     else:
    #         archive.write(path, './'+p[len(path):])
    #     archive.close()

    cur_id = 1
    import zipfile
    import StringIO
    output = StringIO.StringIO()
    archive = zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED)
    archive.writestr("flise_file.csv", str(db(db.flise_file.id == cur_id).select()))
    print str(db(db.flise_file.id == cur_id).select())
    print str(db(db.event.flise_file_id == cur_id).select())
    print str(db(db.subintervals.flise_file_id == cur_id).select())
    print str(db(db.solution.id == db.event.solution_id)(db.event.flise_file_id == cur_id).select(db.solution.id, db.solution.name, db.solution.components_name, db.solution.components_ratio))

    import gluon.contenttype
    response.headers['Content-Type'] = gluon.contenttype.contenttype('.zip')
    response.headers['Content-disposition'] = 'attachment; filename=test.zip'
    return output.getvalue()


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
