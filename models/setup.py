'''
use this function in the default view to start setup if necessary
'''
def check_first_user():
    first_user = db(db.auth_user.id == 1).select().first()
    if not first_user: redirect(URL(request.application, 'setup', 'index'))
    elif not auth.has_membership(user_id = first_user, role = 'admin'):
        auth.add_membership('admin', first_user)

