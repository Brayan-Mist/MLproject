document.addEventListener("DOMContentLoaded", function() {
	
	/*******************************************/
	/********       Верификация        *********/
	
	/** Добавляет ошибку
	*	element - элемент к которому добавляется ошибка
	* error - текст ошибки
	*/ 
	var addError = function(element, error) {
		element.classList.add("error");
		element.setAttribute("data-error", error);
	}
	/** Удаляет ошибку с элемента
	* element - элемент с которого необходимо убрать ошибку
	*/
	var removeError = function(element) {
		element.classList.remove("error");
		element.removeAttribute("data-error");
	}
	
	/**
	* Обработчик верификации ввода почты
	*/
	var errorHandlerEmail = function(e) {
		e = e || window.event;
		var error = lang.error.email;
		
		var regexp = /[a-z0-9!$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[A-Z]{2}|com|org|net|edu|gov|mil|biz|info|mobi|name|aero|asia|jobs|museum|ua|com.ua|ru|com.ru)\b/;
		if (e.target.value === "") {
			addError(e.target.parentNode, error[1]);
		} else if (!regexp.test(e.target.value)) {
			addError(e.target.parentNode, error[0]);
		} else {
			removeError(e.target.parentNode);
		}
	}

	/**
	* Обработчик верификации ввода пароля
	*/
	var errorHandlerPassword = function(e) {
		e = e || window.event;
		var error = lang.error.password;

		if (e.target.value === "") {
			addError(e.target.parentNode, error[1]);
		} else {
			removeError(e.target.parentNode);
		}
	}

	document.getElementById('AuthorizationForm_email').addEventListener("blur", errorHandlerEmail, false);	
	document.getElementById('AuthorizationForm_password').addEventListener("blur", errorHandlerPassword, false);	

	/** Функция добавляет модальное окно на 2 секунды в element с надписью error
	* 750ms - время появления окна
	*/
	var addModalError = function(element, error) {
		var div = document.createElement("div");
		div.className = "modal-error";
		div.style.opacity = 0;
		div.innerHTML = error;
		element.appendChild(div);
		setTimeout(function() {
			div.style.opacity = 1;}, 10);
		
		setTimeout((function(div) {
			return function() {
				div.style.opacity = 0;
		}})(div), 2750);
		div.addEventListener("transitionend", function(e) {
			if (this.style.opacity == 0) {
				this.parentNode.removeChild(this);
			}
		}, false);
	};

	/*******************************************/
	/*****   Авторизация      ******************/
	
	/** Функция, которая добавляет в element прелоадер
	*	element - элемент, в который добавляется прелоадер
	*	return - id setInterval для очистки таймера  
	*/
	var addPreloader = function(element) {
		var pLoader = document.createElement("div");
		pLoader.className = "preloader";
		element.appendChild(pLoader);
		var deg = 0;
		return setInterval(function() {
			if (deg < -360) deg = 0;
			deg-=10;
			pLoader.style.cssText = "transform: rotate("+deg+"deg);";
		}, 50);
	}
	
	/** Функция удаляет прелоадер с element
	*	element - элемент с прелоадером
	* intervalId - идентификатор setInterval для очистки таймера
	*/
	var removePreloader = function(element, intervalId) {
		clearInterval(intervalId);
		element.removeChild(element.querySelector(".preloader"));
	}

	document.forms.AuthorizationForm.onsubmit = function (e) {
		(e.preventDefault)? e.preventDefault() : e.returnValue = false;
		if (!this.querySelector(".error")) {
			var XHR = ("onload" in new XMLHttpRequest()) ? XMLHttpRequest : XDomainRequest;
			var xhr = new XHR();
			var body = new FormData(this);
			var intervalId = addPreloader(this);
			xhr.onload = (function(myForm, id) {
				return function (e) {
					removePreloader(myForm, intervalId);
					var result = JSON.parse(this.responseText);
					if (result['error']) {
						addModalError(myForm, result['error']);
						// Показываем отладку если есть
						if (result['debug']) {
							console.log("Отладка: " + result['debug']);
							alert("Отладочная информация:\n" + result['debug']);
						}
					} else {
						window.location.replace("?enter");
					}
				};
			})(this, intervalId);

			xhr.open("POST", "auth_debug.php", true);
			xhr.send(body);
		}
	};
	/*******************************************/
}, false);
