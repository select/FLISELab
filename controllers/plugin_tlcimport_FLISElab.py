def index():
    form = SQLFORM.factory(
        Field('file', 'upload', requires=IS_NOT_EMPTY(), uploadfield=False),
        Field('created_by', db.auth_user,
            requires=IS_IN_DB(db, '%s.id' % auth.settings.table_user._tablename, '%(first_name)s %(last_name)s', zero = None),
            default=auth.user.id
            ),
        Field('sop', db.tlc_mat_sop,
            label='SOP',
            requires=IS_IN_DB(db, 'tlc_mat_sop.id', '%(name)s (%(id)s)', zero=None)
            ),

    )
    if form.accepts(request.vars, session):
        flise_file_zip = request.vars.file.file
        record_id = db.flise_lab.insert(
            flise_lab_file=db.flise_lab.flise_lab_file.store(flise_file_zip, request.vars.file.filename),
            sop=form.vars.sop,
            created_by=form.vars.created_by,
            edited_by=auth.user.id,
            created_on=request.now,
        )

        import zipfile
        if zipfile.is_zipfile(flise_file_zip):
            zf = zipfile.ZipFile(flise_file_zip, 'r')
            exp_filename_list = [s for s in zf.namelist() if ".xls" in s]
            exp_filename = exp_filename_list[0] # should be just one file
            db.flise_lab[record_id].update_record(
                name=exp_filename[:-4],
                raw_data=db.flise_lab.raw_data.store(zf.open('file.rlv')),
                processed_data=db.flise_lab.processed_data.store(zf.open(exp_filename)),
                #calibration=
            )
            zf.close()
        goto = URL(request.application, 'tlc', 'edit', args=['FLISElab', record_id])
        script = SCRIPT('window.location= "%s";' % goto, _type="text/javascript")
        return TAG['']('success ... check the new data-set at ', A(goto, _href=goto), script)
    return form 