const weekdays = [
	['monday', 'pon'],
	['tuesday', 'uto'],
	['wednesday', 'sri'],
	['thursday', 'čet'],
	['friday', 'pet'],
];
const shiftLabels = { A: 'Popodnevna', B: 'Jutarnja' };
let selectedGroup = localStorage.getItem('tsrb_group') || 'A';
let geoEnabled = localStorage.getItem('tsrb_geo') === 'true';
const periodsByShift = {
	A: [
		{ period: 0, start: '12:45', end: '13:30' },
		{ period: 1, start: '13:35', end: '14:20' },
		{ period: 2, start: '14:25', end: '15:10' },
		{ period: 3, start: '15:15', end: '16:00' },
		{ period: 4, start: '16:20', end: '17:05' },
		{ period: 5, start: '17:10', end: '17:55' },
		{ period: 6, start: '18:00', end: '18:45' },
		{ period: 7, start: '18:50', end: '19:35' },
	],
	B: [
		{ period: 1, start: '07:30', end: '08:15' },
		{ period: 2, start: '08:20', end: '09:05' },
		{ period: 3, start: '09:10', end: '09:55' },
		{ period: 4, start: '10:15', end: '11:00' },
		{ period: 5, start: '11:05', end: '11:50' },
		{ period: 6, start: '11:55', end: '12:40' },
		{ period: 7, start: '12:45', end: '13:30' },
		{ period: 8, start: '13:35', end: '14:20' },
		{ period: 9, start: '14:25', end: '15:10' },
	],
};
const formatDate = (value) => {
	const [year, month, day] = value.split('-');
	return `${day}.${month}.${year}`;
};
const isoWeek = (value) => {
	const date = new Date(`${value}T12:00:00Z`);
	const day = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};
function renderShift(shift, schedule, today, tomorrow, holidays, notices) {
	const todayIndex = new Date(`${today.date}T12:00:00`).getDay();
	const tomorrowDate = new Date(`${today.date}T12:00:00`);
	tomorrowDate.setDate(tomorrowDate.getDate() + 1);
	const tomorrowIndex = tomorrowDate.getDay();
	const currentColumn = todayIndex >= 1 && todayIndex <= 5 ? weekdays[todayIndex - 1][0] : '';
	const tomorrowColumn =
		tomorrowIndex >= 1 && tomorrowIndex <= 5 ? weekdays[tomorrowIndex - 1][0] : '';
	const holidayDates = (holidays.holidays || []).map((holiday) => holiday.date);
	const tripDates = (holidays.trips || []).map((trip) => trip.date);
	const holidayColumns = {};
	const tripColumns = {};
	weekdays.forEach(([key], index) => {
		const date = new Date(`${today.date}T12:00:00`);
		date.setDate(date.getDate() - todayIndex + index + 1);
		const dateKey = date.toISOString().slice(0, 10);
		holidayColumns[key] = holidayDates.indexOf(dateKey) !== -1;
		tripColumns[key] = tripDates.indexOf(dateKey) !== -1;
	});
	const activeShift = today.shift === shift;
	const fortnightIndex = Math.floor((isoWeek(today.date) - 1) / 2) % 2;
	const tomorrowActiveShift = tomorrow.shift === shift;
	const holidayMiddleIndex = Math.floor(periodsByShift[shift].length / 2);
	const subjectsByDay = {};
	const noticeCellsByDay = {};
	const cancelledCellsByDay = {};
	const noticeSidesByDay = {};
	const shiftNoticeNames = shift === 'A' ? ['POSLIJE PODNE'] : ['UJUTRO', 'PRIJE PODNE'];
	weekdays.forEach(([key], weekdayIndex) => {
		const dayDate = new Date(`${today.date}T12:00:00`);
		dayDate.setDate(dayDate.getDate() - todayIndex + weekdayIndex + 1);
		const dateKey = dayDate.toISOString().slice(0, 10);
		const baseSubjects = (schedule.weeks[shift] && schedule.weeks[shift][key]) || [];
		noticeCellsByDay[key] = {};
		cancelledCellsByDay[key] = {};
		noticeSidesByDay[key] = {};
		subjectsByDay[key] = baseSubjects.map((entry, index) => {
			const period =
				periodsByShift[shift][index] && String(periodsByShift[shift][index].period);
			const notice = (notices.notices || []).find(
				(item) =>
					item.date === dateKey &&
					shiftNoticeNames.indexOf(item.shift) !== -1 &&
					String(item.period).replace('.', '') === period
			);
			if (!notice) return entry;
			noticeCellsByDay[key][index] = true;
			cancelledCellsByDay[key][index] = notice.kind === 'cancelled';
			if (entry && typeof entry === 'object') {
				const sides = [];
				if (notice.kind === 'cancelled' || notice.subject === entry.groupA) sides.push('a');
				if (notice.kind === 'cancelled' || notice.subject === entry.groupB) sides.push('b');
				noticeSidesByDay[key][index] = sides;
				return entry;
			}
			return notice.kind === 'cancelled' ? '' : notice.subject;
		});
	});
	const sameEntry = (left, right) =>
		left && right && typeof left === 'object' && typeof right === 'object'
			? left.groupA === right.groupA && left.groupB === right.groupB
			: left === right;
	const renderSubjectCell = (key, index) => {
		const subjects = subjectsByDay[key];
		const entry = subjects[index] || '';
		const splitSubject = entry && typeof entry === 'object';
		const subject = splitSubject ? '' : entry;
		if (index > 0 && sameEntry(entry, subjects[index - 1]) && entry) return '';
		let span = 1;
		while (entry && sameEntry(entry, subjects[index + span])) span += 1;
		const stripedPeriods =
			(schedule.striped_periods &&
				schedule.striped_periods[shift] &&
				schedule.striped_periods[shift][key]) ||
			[];
		const striped = stripedPeriods.indexOf(index) !== -1;
		const dateShiftActive = activeShift || (key === tomorrowColumn && tomorrowActiveShift);
		const holidayForShift = dateShiftActive && holidayColumns[key];
		const tripForShift = dateShiftActive && tripColumns[key];
		const noticeSides = noticeSidesByDay[key][index] || [];
		const cancelled = cancelledCellsByDay[key][index];
		const classes = `${key === currentColumn && activeShift ? 'today' : ''} ${key === tomorrowColumn && tomorrowActiveShift ? 'tomorrow' : ''} ${holidayForShift ? 'holiday' : ''} ${tripForShift ? 'trip' : ''} ${noticeCellsByDay[key][index] ? 'notice-change' : ''} ${cancelled ? 'cancelled-period' : ''} ${noticeSides.indexOf('a') !== -1 ? 'notice-split-a' : ''} ${noticeSides.indexOf('b') !== -1 ? 'notice-split-b' : ''} ${striped ? 'striped-subject' : ''}`;
		const configuredGroup =
			schedule.group_labels &&
			schedule.group_labels[shift] &&
			schedule.group_labels[shift][key] &&
			schedule.group_labels[shift][key][index];
		const rotations =
			schedule.fortnight_groups &&
			schedule.fortnight_groups[shift] &&
			schedule.fortnight_groups[shift][key];
		const fortnightGroup =
			!splitSubject && rotations && rotations[subject]
				? rotations[subject][fortnightIndex]
				: '';
		const displayGroup = configuredGroup || fortnightGroup;
		const groupClass =
			displayGroup === 'A' ? 'group-a-cell' : displayGroup === 'B' ? 'group-b-cell' : '';
		const subjectClass = subject === 'Geo.' ? 'geo-subject' : '';
		const contents = splitSubject
			? `<span class="group-a">${entry.groupA}</span><span class="group-b">${entry.groupB}</span>`
			: subject;
		const containsHolidayCenter =
			index <= holidayMiddleIndex && index + span > holidayMiddleIndex;
		const holidayLabel =
			holidayForShift && containsHolidayCenter
				? '<span class="holiday-overlay">PRAZNIK</span>'
				: tripForShift && containsHolidayCenter
					? '<span class="trip-overlay">IZLET</span>'
					: '';
		const columnEnd = index + span >= periodsByShift[shift].length ? 'column-end' : '';
		const lowerNotice =
			!splitSubject &&
			Array.from(
				{ length: span - 1 },
				(_, offset) => noticeCellsByDay[key][index + offset + 1]
			).some(Boolean);
		const noticeClass = lowerNotice
			? 'notice-lower-half'
			: noticeCellsByDay[key][index]
				? 'notice-change'
				: '';
		const cancelledMark = cancelled ? '<span class="cancelled-mark">X</span>' : '';
		return `<td rowspan="${span}" class="${classes} ${subject || splitSubject || cancelled ? 'has-subject' : ''} ${splitSubject ? 'split-subject' : ''} ${groupClass} ${subjectClass} ${columnEnd} ${noticeClass} ${span > 1 ? 'merged-subject' : ''}">${contents}${cancelledMark}${holidayLabel}</td>`;
	};
	const rows = periodsByShift[shift]
		.map((bell, index) => {
			const period = bell.period;
			return `<tr class="${activeShift && today.active_period && today.active_period.period === period ? 'active' : ''}"><th>${period}.</th><td class="time">${bell.start}<br>${bell.end}</td>${weekdays.map(([key]) => renderSubjectCell(key, index)).join('')}</tr>`;
		})
		.join('');
	return `<div class="table-heading"><h2>${shiftLabels[shift]}</h2></div><div class="table-wrap"><table><thead><tr><th>sat</th><th>vrijeme</th>${weekdays.map(([key, label]) => `<th class="${key === currentColumn && activeShift ? 'today-header' : ''} ${key === tomorrowColumn && tomorrowActiveShift ? 'tomorrow-header' : ''} ${holidayColumns[key] && activeShift ? 'holiday-header' : ''}">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="today-row"><td></td><td></td>${weekdays.map(([key]) => `<td class="${key === currentColumn && activeShift ? 'today' : ''} ${key === tomorrowColumn && tomorrowActiveShift ? 'tomorrow' : ''}">${key === currentColumn && activeShift ? 'DANAS' : key === tomorrowColumn && tomorrowActiveShift ? 'SUTRA' : ''}</td>`).join('')}</tr></tfoot></table></div>`;
}
function updateToggleButtons() {
	document
		.querySelectorAll('.group-button')
		.forEach((button) =>
			button.classList.toggle(
				'active',
				button.dataset.group === selectedGroup ||
					(button.dataset.subject === 'Geo.' && geoEnabled)
			)
		);
}
function setGroup(group) {
	selectedGroup = group;
	document.body.dataset.selectedGroup = group;
	localStorage.setItem('tsrb_group', group);
	updateToggleButtons();
}
function toggleGeo() {
	geoEnabled = !geoEnabled;
	document.body.dataset.geoEnabled = geoEnabled ? 'true' : 'false';
	localStorage.setItem('tsrb_geo', geoEnabled);
	updateToggleButtons();
}
document
	.querySelectorAll('.group-button')
	.forEach((button) =>
		button.addEventListener('click', () =>
			button.dataset.subject ? toggleGeo() : setGroup(button.dataset.group)
		)
	);
setGroup(selectedGroup);
document.body.dataset.geoEnabled = geoEnabled ? 'true' : 'false';
updateToggleButtons();
async function refresh() {
	try {
		const [today, tomorrow, schedule, holidays, notices] = await Promise.all([
			fetch('api/today', { cache: 'no-store' }).then((r) => r.json()),
			fetch('api/tomorrow', { cache: 'no-store' }).then((r) => r.json()),
			fetch('api/schedule', { cache: 'no-store' }).then((r) => r.json()),
			fetch('api/holidays', { cache: 'no-store' }).then((r) => r.json()),
			fetch('api/notices', { cache: 'no-store' }).then((r) => r.json()),
		]);
		window.appData = { today, tomorrow, schedule, holidays};
		document.querySelector('#date').textContent = formatDate(today.date);
		document.querySelector('#shift-a').innerHTML = renderShift(
			'A',
			schedule,
			today,
			tomorrow,
			holidays,
			notices
		);
		document.querySelector('#shift-b').innerHTML = renderShift(
			'B',
			schedule,
			today,
			tomorrow,
			holidays,
			notices
		);
	} catch (error) {
		document.querySelector('#shift-a').textContent = 'Raspored nije dostupan, kontaktirajte administratora (Pasko/Marin)';
	}
}

const toSec = (hhmm) => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 3600 + m * 60;
};
const fmtCountdown = (s) => {
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const mm = String(m).padStart(2, '0');
	const ss = String(sec).padStart(2, '0');
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const subjectAt = (shift, dayKey, index) => {
	const data = window.appData;
	const entry =
		data &&
		data.schedule.weeks[shift] &&
		data.schedule.weeks[shift][dayKey] &&
		data.schedule.weeks[shift][dayKey][index];
	if (!entry) return '';
	return typeof entry === 'object' ? entry['group' + selectedGroup] || '' : entry;
};
function countdownText() {
	const data = window.appData;
	if (!data) return '--:--:--';

	const shift = data.today.shift;
    const dayIdx = new Date(`${data.today.date}T12:00:00`).getDay();


    const holidayDates = (data.holidays?.holidays || []).map((h) => h.date);
    const tripDates = (data.holidays?.trips || []).map((t) => t.date);
    const isHolidayOrTrip =
        holidayDates.includes(data.today.date) || tripDates.includes(data.today.date);

    if (!shift || dayIdx < 1 || dayIdx > 5 || isHolidayOrTrip) return 'Nema nastave';
    
    const dayKey = weekdays[dayIdx - 1][0];
	const periods = periodsByShift[shift];

	const parts = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone: 'Europe/Zagreb',
	}).formatToParts(new Date());
	const get = (t) => Number(parts.find((p) => p.type === t).value) % 24;
	const now = get('hour') * 3600 + get('minute') * 60 + get('second');

	// prije prvog sata
	if (now < toSec(periods[0].start)) {
		return `Do 1. sata: ${fmtCountdown(toSec(periods[0].start) - now)}`;
	}
	for (let i = 0; i < periods.length; i++) {
		const start = toSec(periods[i].start);
		const end = toSec(periods[i].end);
		const next = periods[i + 1];
		const nextSubject = next ? subjectAt(shift, dayKey, i + 1) : '';
		const nextLabel = next ? ` | Sljedeće: ${nextSubject || 'slobodno'}` : ' | Zadnji sat';
		if (now >= start && now < end) {
			return `Do zvona: ${fmtCountdown(end - now)}${nextLabel}`;
		}
		if (next && now >= end && now < toSec(next.start)) {
			return `Odmor: ${fmtCountdown(toSec(next.start) - now)} | Sljedeće: ${nextSubject || 'slobodno'}`;
		}
	}
	return 'Nastava završena';
}

function tick() {
	const now = new Date();
	document.querySelector('#day').textContent = new Intl.DateTimeFormat('hr-HR', {
		weekday: 'long',
		timeZone: 'Europe/Zagreb',
	}).format(now);
	document.querySelector('#clock').textContent = countdownText();
}
tick();
setInterval(tick, 1000);
refresh();
setInterval(refresh, 300000);
