
function showregole(){
    $("#regole_container").css("display","inherit");
    $("#regole_container").addClass("animated slideInLeft");
    setTimeout(function(){
        $("#regole_container").removeClass("animated slideInLeft");
    },800);
}
function closeregole(){
    $("#regole_container").addClass("animated slideOutLeft");
    setTimeout(function(){
        $("#regole_container").removeClass("animated slideOutLeft");
        $("#regole_container").css("display","none");
    },800);
}
function showlofi(){
    $("#lofi_container").css("display","inherit");
    $("#lofi_container").addClass("animated slideInRight");
    setTimeout(function(){
        $("#lofi_container").removeClass("animated slideInRight");
    },800);
}
function closelofi(){
    $("#lofi_container").addClass("animated slideOutRight");
    setTimeout(function(){
        $("#lofi_container").removeClass("animated slideOutRight");
        $("#lofi_container").css("display","none");
    },800);
}

function showleaderboard(){
    $("#classifica_container").css("display","inherit");
    $("#classifica_container").addClass("animated slideInDown");
    setTimeout(function(){
        $("#classifica_container").removeClass("animated slideInDown");
    },800);
}
function closeleaderboard(){
    $("#classifica_container").addClass("animated slideOutUp");
    setTimeout(function(){
        $("#classifica_container").removeClass("animated slideOutUp");
        $("#classifica_container").css("display","none");
    },800);
}

setTimeout(function(){
    $("#loading").addClass("animated fadeOut");
    setTimeout(function(){
      $("#loading").removeClass("animated fadeOut");
      $("#loading").css("display","none");
      $("#box").css("display","none");
      $("#regole").removeClass("animated fadeIn");
      $("#lofi").removeClass("animated fadeIn");
      $("#classifica").removeClass("animated fadeIn");
    },1000);
},1500);
