# -*- coding: utf-8 -*-

#########################################################################
## This scaffolding model makes your app work on Google App Engine too
## File is released under public domain and you can use without limitations
#########################################################################

if not request.env.web2py_runtime_gae:     
    ## if NOT running on Google App Engine use SQLite or other DB
    db = DAL('sqlite://storage.sqlite') 
else:
    ## connect to Google BigTable (optional 'google:datastore://namespace')
    db = DAL('google:datastore') 
    ## store sessions and tickets there
    session.connect(request, response, db = db) 
    ## or store session in Memcache, Redis, etc.
    ## from gluon.contrib.memdb import MEMDB
    ## from google.appengine.api.memcache import Client
    ## session.connect(request, response, db = MEMDB(Client()))

## by default give a view/generic.extension to all actions from localhost
## none otherwise. a pattern can be 'controller/function.extension'
response.generic_patterns = ['*'] if request.is_local else []

#########################################################################
#this is a config helper 
db.define_table('config',
        Field('section'),
        Field('option'),
        Field('value')
        )
class Config:
    '''configure general things needed'''

    def __init__(self):
        self.create('pymantis','url','http://pymantis.org/pymantis_server/tlc/records/Demo_Table')
        self.create('pymantis','login','user:password')
    def get(self, section, option):
        '''get a value'''
        record = db(db.config.option == option)(db.config.section == section).select(db.config.value).first()
        if record:
            return record.value.strip()

    def create(self, section, option, value):
        '''create value if it does not exist'''
        if not db(db.config.option == option)(db.config.section == section).count():
            db.config.insert(section = section, option = option, value = value)

    def set(self, section, option, value):
        '''set or update a value'''
        record = db(db.config.option == option)(db.config.section == section).select().first()
        if record:
            #record.update_record(value = value)
            db.config[record.id] = dict(section = section, option = option, value = value)
        else:
            db.config.insert(section = section, option = option, value = value)
    def write(self):
        pass
app_config = Config()
#########################################################################
#########################################################################
## Here is sample code if you need for
## - email capabilities
## - authentication (registration, login, logout, ... )
## - authorization (role based authorization)
## - services (xml, csv, json, xmlrpc, jsonrpc, amf, rss)
## - old style crud actions
## (more options discussed in gluon/tools.py)
#########################################################################

from gluon.tools import Auth, Crud, Service, PluginManager, prettydate
auth = Auth(db, hmac_key=Auth.get_or_create_key()) 
crud, service, plugins = Crud(db), Service(), PluginManager()

## create all tables needed by auth if not custom tables
auth.define_tables() 

## configure email
mail=auth.settings.mailer
mail.settings.server = 'logging' or 'smtp.gmail.com:587'
mail.settings.sender = 'you@gmail.com'
mail.settings.login = 'username:password'

## configure auth policy
auth.settings.registration_requires_verification = False
auth.settings.registration_requires_approval = False
auth.settings.reset_password_requires_verification = True

## if you need to use OpenID, Facebook, MySpace, Twitter, Linkedin, etc.
## register with janrain.com, write your domain:api_key in private/janrain.key
from gluon.contrib.login_methods.rpx_account import use_janrain
use_janrain(auth,filename='private/janrain.key')
#########################################################################
#login as first user if user comes from localhost
#########################################################################
import os.path
if not auth.is_logged_in() and db(db.auth_user.id>0).count() and not os.path.exists(os.path.join(request.folder, 'LOCK')) and (request.env.remote_addr in '127.0.0.1 localhost'.split()):
    from gluon.storage import Storage
    user = db(db.auth_user.id==1).select().first()
    auth.user = Storage(auth.settings.table_user._filter_fields(user, id=True))
    auth.environment.session.auth = Storage(user=user, last_visit=request.now,
                                            expiration=auth.settings.expiration)
    response.flash = 'You were automatically logged in as %s %s. To prevent this create the file %s'%(user.first_name, user.last_name, os.path.join(request.folder, 'LOCK'))
#########################################################################

#########################################################################
## Define your tables below (or better in another model file) for example
##
## >>> db.define_table('mytable',Field('myfield','string'))
##
## Fields can be 'string','text','password','integer','double','boolean'
##       'date','time','datetime','blob','upload', 'reference TABLENAME'
## There is an implicit 'id integer autoincrement' field
## Consult manual for more options, validators, etc.
##
## More API examples for controllers:
##
## >>> db.mytable.insert(myfield='value')
## >>> rows=db(db.mytable.myfield=='value').select(db.mytable.ALL)
## >>> for row in rows: print row.id, row.myfield
#########################################################################
db.define_table('strain',
        Field('name'),
        Field('identifier', 'integer')
        )
db.define_table('flise_file',
        Field('name', requires=IS_NOT_EMPTY()),
        Field('file', 'upload', autodelete=True, requires=IS_NOT_EMPTY()),
        Field('rlvfile', 'upload', autodelete=True, requires=IS_NOT_EMPTY(), label='RLV file'),
        Field('sampling_time', 'double', default=0.5, requires=IS_NOT_EMPTY(), label='Sampling Time (s)'),
        Field('created_on', 'date', default=request.now),
        #Field('created_by', db.auth_user),
        Field('series_species', 'list:string', readable=False, writable=False),
        Field('series_colors', 'list:string', readable=False, writable=False),
        Field('series_show', 'list:string', readable=False, writable=False),
        Field('series_slope', 'list:string', readable=False, writable=False),  # JSON list of doubles
        Field('strain_id', db.strain, readable=False, writable=False),
        Field('comments', 'text', readable=False, writable=False),
        Field('optical_density', 'double', readable=False, writable=False),
        Field('dilution_factor', 'double', readable=False, writable=False),
        Field('cell_diameter', 'double', readable=False, writable=False),
        Field('disp_smooth', 'boolean', readable=False, writable=False),
        Field('disp_smooth_value', 'integer', readable=False, writable=False),
        Field('autoseg_win', 'integer', readable=False, writable=False),
        Field('autoseg_fuse', 'integer', readable=False, writable=False),
        Field('sg_win', 'integer', default=40, readable=False, writable=False),
        Field('sg_order', 'integer', default=4, readable=False, writable=False),
        Field('sg_overlay', 'boolean', default=False, readable=False, writable=False),
        Field('dropT', 'text', readable=False, writable=False),  # JSON
        Field('cutT', 'text', readable=False, writable=False),  # JSON
        Field('nodiffT', 'text', readable=False, writable=False),  # JSON
        Field('eventT', 'text', readable=False, writable=False),  # JSON
        )
db.define_table('subintervals',
        Field('flise_file_id', db.flise_file, requires=IS_IN_DB(db, 'flise_file.id', '%(name)s [%(id)s]', zero=None)),
        Field('name'),
        Field('extract_time', 'text'),  # pickle/JSON
        Field('strain_id', db.strain, readable=False, writable=False),
        Field('comments', 'text', readable=False, writable=False),
        Field('optical_density', 'double', readable=False, writable=False),
        Field('dilution_factor', 'double', readable=False, writable=False),
        Field('cell_diameter', 'double', readable=False, writable=False),
        Field('intercept', 'list:string'),  # JSON list of doubles
        Field('slope', 'list:string'),  # JSON list of doubles
        )
db.define_table('solution',
        Field('name'),
        Field('components_name', 'list:string', readable=False, writable=False),
        Field('components_ratio', 'list:string', readable=False, writable=False),
        )
db.define_table('event',
        Field('flise_file_id', db.flise_file, requires=IS_IN_DB(db, 'flise_file.id', '%(name)s [%(id)s]', zero=None)),
        Field('time', 'double'),
        Field('type', requires=IS_IN_SET('wash calibration injection comment dilution removal'.split())),
        Field('series_id', 'integer'),
        Field('series_name', 'text'),
        Field('solution_id', db.solution, readable=False, writable=False),
        Field('concentration', 'double'),
        Field('volume', 'double'),
        Field('comment', 'text', readable=False, writable=False),
        )
db.define_table('flise_lab',
        Field('name', requires=IS_NOT_EMPTY()),
        Field('processed_data', 'upload', autodelete=True, requires=IS_NOT_EMPTY()),
        Field('raw_data', 'upload', autodelete=True, requires=IS_NOT_EMPTY(), label='RLV file'),
        Field('flise_lab_file', 'upload', autodelete=True, requires=IS_NOT_EMPTY()),
        #Field('sop', db.tlc_mat_sop, label = 'SOP', requires = IS_IN_DB(db, 'tlc_mat_sop.id', '%(name)s (%(id)s)', zero = None)),
        Field('created_by', db.auth_user, requires=IS_IN_DB(db, '%s.id' % auth.settings.table_user._tablename, '%(first_name)s %(last_name)s', zero=None)),
        Field('edited_by',db.auth_user,
            label = 'Last Edit By',
            writable=False,
            requires = IS_IN_DB(db, '%s.id' % auth.settings.table_user._tablename, '%(first_name)s %(last_name)s')
            ),
        Field("created_on","datetime",
            label = 'Last Edit Time',
            default = request.now,
            writable = False,
            ),
        Field("active", 'boolean',
            default = True,
            readable = False,
            writable = False,
            ),
        format = '%(name)s', 
        )

JS = lambda x: SCRIPT(x, _type="text/javascript")


#def parse_raw_flise(raw_file):
#   import csv
#    reader = list(csv.reader(raw_file, delimiter="\t"))
#    time_col = [[i * .5] + line[:-1] for i, line in enumerate(reader)]
