let applications = JSON.parse(localStorage.getItem("applications")) || [];
let editingId = null;

const submitButton = document.getElementById("submitButton");
const cancelButton = document.getElementById("cancelButton");

const jobForm = document.getElementById("jobForm");


// Add Application
jobForm.addEventListener("submit", function(event) {
    event.preventDefault();

    let company = document.getElementById("company").value;
    let role = document.getElementById("role").value;
    let status = document.getElementById("status").value;
    let date = document.getElementById("date").value;
    let notes = document.getElementById("notes").value;

    let application = {
    id: editingId !== null ? editingId : Date.now(),
    company: company,
    role: role,
    status: status,
    date: date,
    notes: notes
};

    if (editingId === null) {

    applications.push(application);

} else {

    let applicationIndex = applications.findIndex(function(application) {
        return application.id === editingId;
    });

    applications[applicationIndex] = application;

    editingId = null;

    submitButton.textContent = "Add Application";
    cancelButton.style.display = "none";
}

localStorage.setItem("applications", JSON.stringify(applications));

jobForm.reset();

updateDashboard();
displayApplications();
});


// Display Applications
function displayApplications(list = applications) {

    let applicationList = document.getElementById("applicationList");

    applicationList.innerHTML = "";

    if (list.length === 0) {
        applicationList.innerHTML = `
            <p class="empty-message">
                No applications found.
            </p>
        `;
        return;
    }

    list.forEach(function(application) {

        let applicationCard = document.createElement("div");

        applicationCard.className = "application-card";

        applicationCard.innerHTML = `
            <h3>${application.company}</h3>

            <p>
                <strong>Role:</strong>
                ${application.role}
            </p>

            <p>
                <strong>Status:</strong>
                <span class="status ${application.status.toLowerCase()}">
                    ${application.status}
                </span>
            </p>

            <p>
                <strong>Date:</strong>
                ${application.date}
            </p>

            <p>
                  <strong>Notes:</strong>
                  ${application.notes || "No notes"}
              </p>

            <button onclick="editApplication(${application.id})">
                Edit
            </button>

            <button onclick="deleteApplication(${application.id})">
                Delete
            </button>
        `;

        applicationList.appendChild(applicationCard);
    });
}


// Delete Application
function deleteApplication(id) {

    let confirmDelete = confirm("Are you sure you want to delete this application?");

    if (!confirmDelete) {
        return;
    }

    applications = applications.filter(function(application) {
        return application.id !== id;
    });

    localStorage.setItem("applications", JSON.stringify(applications));

    updateDashboard();
    displayApplications();
}


// Update Dashboard
function updateDashboard() {

    document.getElementById("totalApplications").textContent =
        applications.length;

    document.getElementById("interviews").textContent =
        applications.filter(function(application) {
            return application.status === "Interview";
        }).length;

    document.getElementById("selected").textContent =
        applications.filter(function(application) {
            return application.status === "Selected";
        }).length;

    document.getElementById("rejected").textContent =
        applications.filter(function(application) {
            return application.status === "Rejected";
        }).length;
}

// Search, Filter and Sort
const search = document.getElementById("search");
const filterStatus = document.getElementById("filterStatus");
const sortDate = document.getElementById("sortDate");

function filterApplications() {

    let searchText = search.value.toLowerCase();
    let selectedStatus = filterStatus.value;
    let selectedSort = sortDate.value;

    let filteredApplications = applications.filter(function(application) {

        let matchesSearch = application.company
            .toLowerCase()
            .includes(searchText);

        let matchesStatus =
            selectedStatus === "All" ||
            application.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    filteredApplications.sort(function(a, b) {

        if (selectedSort === "newest") {
            return new Date(b.date) - new Date(a.date);
        } else {
            return new Date(a.date) - new Date(b.date);
        }

    });

    displayApplications(filteredApplications);
}

search.addEventListener("input", filterApplications);

filterStatus.addEventListener("change", filterApplications);

sortDate.addEventListener("change", filterApplications);

// Edit Application
function editApplication(id) {

    let application = applications.find(function(application) {
        return application.id === id;
    });

    document.getElementById("company").value = application.company;
    document.getElementById("role").value = application.role;
    document.getElementById("status").value = application.status;
    document.getElementById("date").value = application.date;
    document.getElementById("notes").value = application.notes || "";

    editingId = id;

    submitButton.textContent = "Update Application";
    cancelButton.style.display = "inline-block";

    document.getElementById("company").focus();
}
cancelButton.addEventListener("click", function() {

    editingId = null;

    jobForm.reset();

    submitButton.textContent = "Add Application";
    cancelButton.style.display = "none";

    document.getElementById("company").focus();
});


// Load Data
updateDashboard();
displayApplications();