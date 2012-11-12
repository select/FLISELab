def index():
    form = SQLFORM.factory(
        Field('file', 'upload', requires=IS_NOT_EMPTY(), uploadfield=False),
        Field('created_by', db.auth_user,
            requires = IS_IN_DB(db, '%s.id' % auth.settings.table_user._tablename, '%(first_name)s %(last_name)s', zero = None),
            default = auth.user.id
            ),
    )
    if form.accepts(request.vars, session):
        flag = True
        flise_file_zip = request.vars.file.file
        import zipfile
        if zipfile.is_zipfile(flise_file_zip):
            zf = zipfile.ZipFile(flise_file_zip, 'r')
            for filename in ['flise_file.csv', 'events.csv', 'subintervals.csv', 'solutions.csv', 'file.txt', 'file.rlv']:
                try:
                    zf.getinfo(filename)
                except KeyError:
                    flag = False
            if flag:
                exp_filename_list = [s for s in zf.namelist() if ".xls" in s]
                exp_filename = exp_filename_list[0] # should be just one file
                record_id = db.flise_lab.insert(
                    name=exp_filename[:-4],
                    raw_data= db.flise_lab.raw_data.store(zf.open('file.rlv')),
                    processed_data=db.flise_lab.raw_data.store(zf.open(exp_filename)),
                    flise_lab_file=db.flise_lab.file(flise_file_zip),
                    #sop=
                    #calibration=
                    created_by = form.vars.edited_by,
                    edited_by = auth.user.id,
                    created_on = request.now,
                )
            zf.close()
        goto = URL(request.application, 'tlc', 'edit', args=['FLISElab', record_id])
        script = SCRIPT('window.location.replace(%s)' % goto, _type="text/javascript")
        return TAG['']('success ... check the new data-set at ', A(goto, _href=goto), script)
    return form 