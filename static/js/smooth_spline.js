//  Spline smoothing  (DeBoor's algorithm)
//
// Adapted to JS from the following Matlab source file
//    found at http://www.eng.mu.edu/frigof/spline.html

function smooth_spline(data, smooth_factor) {
    var npoint = data.length;
    if (npoint==1) {return data;}

    var dx = [];
    var buffer = 1;
    for (var i = data.length - 1; i >= 0; i--) {
        buffer = (data[i] == 0) ? buffer : data[i]; //FIX: dx is Inf for data=0, we want to prevent this...
        dx.unshift(Math.exp(-0.25*Math.log(Math.abs(buffer))));
    }
    //linspace
    var x = [(npoint-1.0)/npoint];
    for (i = npoint-2; i >= 0; i--) {
        x.unshift(i/npoint);
    }

    /*//Output data to compare result in Matlab
    var str='sig = [';
    for (i = 0; i < data.length; i++) {
        str=str.concat((i==0)?'':',').concat(data[i].toString());
    }
    str.concat('];');*/

    // setupq
    var v1=[null];
    var v2=[null];
    var v3=[0];
    var v4=[x[1]-x[0]];
    var v5=[null];
    var v6=[null];
    var v7=[null];
    for (i = 1; i < npoint-1; i++) {
        v4.push(x[i+1]-x[i]);
        v1.push(dx[i-1]/v4[i-1]);
        v2.push(((-dx[i])/v4[i]) - (dx[i]/v4[i-1]));
        v3.push(dx[i+1]/v4[i]);
    }
    v1.push(0);
    for (i = 1; i < npoint-1; i++) {
        v5.push(v1[i]*v1[i] + v2[i]*v2[i] + v3[i]*v3[i]);
    }
    for (i = 2; i < npoint-1; i++) {
        v6.push(v2[i-1]*v1[i] + v3[i-1]*v2[i]);
    }
    v6.push(0);
    for (i = 3; i < npoint-1; i++) {
        v7.push(v3[i-2]*v1[i]);
    }
    v7.push(0);
    v7.push(0);
    //!
    //!  Construct  q-transp. * data  in  a4
    //!
    var prev = (data[1]-data[0])/v4[0];
    var diff;
    var a3 = [0];
    var a4 = [null];
    for (i = 1; i < npoint-1; i++) {
        diff = (data[i+1]-data[i])/v4[i];
        a4.push(diff - prev);
        prev = diff;
    }
    // end setupq

    //chol1d

    //!
    //!  Construct 6*(1-smooth_factor)*q-transp.*(d**2)*q + smooth_factor*r
    //!
    var six1mp = 6.0*(1.0-smooth_factor);
    var twop = 2.0*smooth_factor;
    for (i = npoint-2; i >= 1; i--) {
        v1[i] = six1mp*v5[i] + twop*(v4[i-1]+v4[i]);
        v2[i] = six1mp*v6[i] + smooth_factor*v4[i];
        v3[i] = six1mp*v7[i];
    }

    //!
    //!  Factorization
    //!
    var ratio;
    for (i = 1; i < npoint-2; i++) {
        ratio = v2[i]/v1[i];
        v1[i+1] -= ratio*v2[i];
        v2[i+1] -= ratio*v3[i];
        v2[i] = ratio;
        ratio = v3[i]/v1[i];
        v1[i+2] -= ratio*v3[i];
        v3[i] = ratio;
    }
    //!
    //!  Forward substitution
    //!
    a3.push(a4[1]);
    for (i = 1; i < npoint-2; i++) {
        a3.push(a4[i+1] - v2[i] * a3[i] - v3[i-1] * a3[i-1]);
    }
    //!
    //!  Back substitution.
    //!
    a3[npoint-2] /= v1[npoint-2];
    a3.push(0);
    for (i = npoint-3; i >= 1; i--) {
        a3[i] = a3[i] / v1[i] - a3[i+1] * v2[i] - a3[i+2] * v3[i];
    }
    //!
    //!  Construct Q*U.
    //!
    prev = 0.0;
    var a1=[null];
    for (i = 1; i < npoint; i++) {
        a1.push((a3[i] - a3[i-1]) / v4[i-1]);
        a1[i-1] = a1[i] - prev;
        prev = a1[i];
    }
    a1[npoint-1] *= -1;

    //end chol1d

    var smoothed_data = [];
    for (i = 0; i < npoint; i++) {
        smoothed_data.push(data[i] - (6*(1-smooth_factor)*dx[i]*dx[i]*a1[i]));
    }

    return smoothed_data;
}