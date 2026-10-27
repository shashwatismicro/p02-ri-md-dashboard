sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/json/JSONModel",
        "com/oswal/managementcockpit/managementcockpit/service/ProductionDataService"
    ],
    function (
        Controller,
        JSONModel,
        ProductionDataService
    ) {
        "use strict";

        return Controller.extend(
            "com.oswal.managementcockpit.managementcockpit.controller.Production",
            {
                onInit() {
                    const oProductionModel =
                        new JSONModel({
                            kpis: [
                                {
                                    title: "KPI 1",
                                    value: "N/A",
                                    status: "Not configured"
                                },
                                {
                                    title: "KPI 2",
                                    value: "N/A",
                                    status: "Not configured"
                                },
                                {
                                    title: "KPI 3",
                                    value: "N/A",
                                    status: "Not configured"
                                },
                                {
                                    title: "KPI 4",
                                    value: "N/A",
                                    status: "Not configured"
                                }
                            ],

                            columnDates: [],
                            rows: [],

                            keyDate: "",
                            weekStartDate: "",
                            weekEndDate: "",
                            dateRangeText:
                                "Date range will be determined automatically.",

                            plant: "",
                            plantLabel:
                                "Plant: Not available",

                            busy: false,
                            loaded: false,

                            statusText:
                                "Not loaded",
                            statusState:
                                "Information",

                            errorMessage: ""
                        });

                    this.getView().setModel(
                        oProductionModel,
                        "production"
                    );

                    this._bProductionDataLoaded =
                        false;

                    this._sLastLoadSignature =
                        "";

                    this._iProductionLoadSequence =
                        0;
                },

                async loadProductionData(
                    sSelectedPlant
                ) {
                    const oProductionModel =
                        this.getView().getModel(
                            "production"
                        );

                    const oODataModel =
                        this.getView().getModel();

                    const sEffectivePlant =
                        sSelectedPlant ||
                        "ALL";

                    const oYesterday =
                        this._getYesterday();

                    const aWeekDates =
                        this._getCalendarWeekDates(
                            oYesterday
                        );

                    const sKeyDate =
                        this._formatDateForOData(
                            oYesterday
                        );

                    const sWeekStartDate =
                        this._formatDateForOData(
                            aWeekDates[0]
                        );

                    const sWeekEndDate =
                        this._formatDateForOData(
                            aWeekDates[6]
                        );

                    const sLoadSignature =
                        `${sKeyDate}|${sEffectivePlant}`;

                    /*
                     * Avoid downloading identical Production
                     * data repeatedly during the same session.
                     */
                    if (
                        this._bProductionDataLoaded &&
                        this._sLastLoadSignature ===
                            sLoadSignature
                    ) {
                        return;
                    }

                    this._iProductionLoadSequence +=
                        1;

                    const iLoadSequence =
                        this._iProductionLoadSequence;

                    const aColumnDates =
                        aWeekDates.map(
                            (
                                oDate,
                                iIndex
                            ) => ({
                                index:
                                    iIndex + 1,

                                date:
                                    this._formatDateForOData(
                                        oDate
                                    ),

                                label:
                                    this._formatProductionDateLabel(
                                        oDate
                                    )
                            })
                        );

                    const sPlantLabel =
                        sEffectivePlant ===
                        "ALL"
                            ? "Plant: All Plants"
                            : `Plant: ${sEffectivePlant}`;

                    const sDateRangeText =
                        `Week: ` +
                        `${this._formatProductionDateLabel(
                            aWeekDates[0]
                        )} to ` +
                        `${this._formatProductionDateLabel(
                            aWeekDates[6]
                        )}`;

                    oProductionModel.setProperty(
                        "/plant",
                        sEffectivePlant
                    );

                    oProductionModel.setProperty(
                        "/plantLabel",
                        sPlantLabel
                    );

                    oProductionModel.setProperty(
                        "/keyDate",
                        sKeyDate
                    );

                    oProductionModel.setProperty(
                        "/weekStartDate",
                        sWeekStartDate
                    );

                    oProductionModel.setProperty(
                        "/weekEndDate",
                        sWeekEndDate
                    );

                    oProductionModel.setProperty(
                        "/dateRangeText",
                        sDateRangeText
                    );

                    oProductionModel.setProperty(
                        "/columnDates",
                        aColumnDates
                    );

                    oProductionModel.setProperty(
                        "/busy",
                        true
                    );

                    oProductionModel.setProperty(
                        "/loaded",
                        false
                    );

                    oProductionModel.setProperty(
                        "/statusText",
                        "Loading Production data"
                    );

                    oProductionModel.setProperty(
                        "/statusState",
                        "Information"
                    );

                    oProductionModel.setProperty(
                        "/errorMessage",
                        ""
                    );

                    try {
                        const aProductionData =
                            await ProductionDataService
                                .requestProductionData(
                                    oODataModel,
                                    sKeyDate
                                );

                        /*
                         * Ignore the result if another Production
                         * request was started while this request
                         * was still loading.
                         */
                        if (
                            iLoadSequence !==
                            this
                                ._iProductionLoadSequence
                        ) {
                            return;
                        }

                        const aTableRows =
                            this
                                ._buildProductionTableData(
                                    aProductionData,
                                    aWeekDates,
                                    sEffectivePlant
                                );

                        oProductionModel.setProperty(
                            "/rows",
                            aTableRows
                        );

                        oProductionModel.setProperty(
                            "/loaded",
                            true
                        );

                        if (
                            aTableRows.length > 0
                        ) {
                            oProductionModel.setProperty(
                                "/statusText",
                                "Live Production data loaded"
                            );

                            oProductionModel.setProperty(
                                "/statusState",
                                "Success"
                            );
                        } else {
                            oProductionModel.setProperty(
                                "/statusText",
                                "No Production data"
                            );

                            oProductionModel.setProperty(
                                "/statusState",
                                "Warning"
                            );
                        }

                        this
                            ._bProductionDataLoaded =
                            true;

                        this
                            ._sLastLoadSignature =
                            sLoadSignature;

                        console.info(
                            "Production data loaded:",
                            {
                                keyDate:
                                    sKeyDate,

                                weekStartDate:
                                    sWeekStartDate,

                                weekEndDate:
                                    sWeekEndDate,

                                selectedPlant:
                                    sEffectivePlant,

                                sourceRows:
                                    aProductionData
                                        .length,

                                tableRows:
                                    aTableRows
                                        .length
                            }
                        );
                    } catch (
                        oError
                    ) {
                        if (
                            iLoadSequence !==
                            this
                                ._iProductionLoadSequence
                        ) {
                            return;
                        }

                        this
                            ._bProductionDataLoaded =
                            false;

                        this
                            ._sLastLoadSignature =
                            "";

                        oProductionModel.setProperty(
                            "/rows",
                            []
                        );

                        oProductionModel.setProperty(
                            "/loaded",
                            false
                        );

                        oProductionModel.setProperty(
                            "/statusText",
                            "Production data unavailable"
                        );

                        oProductionModel.setProperty(
                            "/statusState",
                            "Error"
                        );

                        oProductionModel.setProperty(
                            "/errorMessage",
                            oError.message ||
                            "Production data could not be loaded."
                        );

                        console.error(
                            "Production data loading failed:",
                            oError
                        );
                    } finally {
                        if (
                            iLoadSequence ===
                            this
                                ._iProductionLoadSequence
                        ) {
                            oProductionModel.setProperty(
                                "/busy",
                                false
                            );
                        }
                    }
                },

                _getYesterday() {
                    const oToday =
                        new Date();

                    return new Date(
                        oToday.getFullYear(),
                        oToday.getMonth(),
                        oToday.getDate() - 1
                    );
                },

                _getCalendarWeekDates(
                    oReferenceDate
                ) {
                    const iDayOfWeek =
                        oReferenceDate.getDay();

                    /*
                     * JavaScript:
                     * Sunday = 0
                     * Monday = 1
                     *
                     * Determine the Monday belonging to
                     * the calendar week of the reference date.
                     */
                    const iDaysSinceMonday =
                        iDayOfWeek === 0
                            ? 6
                            : iDayOfWeek - 1;

                    const oWeekStart =
                        new Date(
                            oReferenceDate.getFullYear(),
                            oReferenceDate.getMonth(),
                            oReferenceDate.getDate() -
                                iDaysSinceMonday
                        );

                    return Array.from(
                        {
                            length: 7
                        },
                        (
                            _,
                            iIndex
                        ) =>
                            new Date(
                                oWeekStart.getFullYear(),
                                oWeekStart.getMonth(),
                                oWeekStart.getDate() +
                                    iIndex
                            )
                    );
                },

                _formatDateForOData(
                    oDate
                ) {
                    return [
                        oDate.getFullYear(),
                        String(
                            oDate.getMonth() + 1
                        ).padStart(
                            2,
                            "0"
                        ),
                        String(
                            oDate.getDate()
                        ).padStart(
                            2,
                            "0"
                        )
                    ].join("-");
                },

                _formatProductionDateLabel(
                    oDate
                ) {
                    return oDate
                        .toLocaleDateString(
                            "en-GB",
                            {
                                day:
                                    "2-digit",
                                month:
                                    "long"
                            }
                        )
                        .replace(
                            " ",
                            "-"
                        );
                },

                _formatMetricTons(
                    nQuantityInKG
                ) {
                    const nMetricTons =
                        Number(
                            nQuantityInKG || 0
                        ) / 1000;

                    return nMetricTons
                        .toLocaleString(
                            "en-IN",
                            {
                                minimumFractionDigits:
                                    3,
                                maximumFractionDigits:
                                    3
                            }
                        );
                },

                _buildProductionTableData(
                    aProductionData,
                    aWeekDates,
                    sSelectedPlant
                ) {
                    const sWeekStartDate =
                        this._formatDateForOData(
                            aWeekDates[0]
                        );

                    const aWeekDateKeys =
                        aWeekDates.map(
                            (oDate) =>
                                this
                                    ._formatDateForOData(
                                        oDate
                                    )
                        );

                    const aRelevantRows =
                        aProductionData.filter(
                            (oRow) => {
                                if (
                                    sSelectedPlant ===
                                    "ALL"
                                ) {
                                    return true;
                                }

                                return (
                                    String(
                                        oRow.Plant ||
                                        ""
                                    ).trim() ===
                                    sSelectedPlant
                                );
                            }
                        );

                    const mCategories = {};

                    aRelevantRows.forEach(
                        (oRow) => {
                            const sCategory =
                                String(
                                    oRow.Category ||
                                    ""
                                ).trim();

                            if (!sCategory) {
                                return;
                            }

                            if (
                                !mCategories[
                                    sCategory
                                ]
                            ) {
                                mCategories[
                                    sCategory
                                ] = {
                                    category:
                                        sCategory,

                                    cumulativeValueKG:
                                        0,

                                    dailyValuesKG:
                                        [
                                            0,
                                            0,
                                            0,
                                            0,
                                            0,
                                            0,
                                            0
                                        ]
                                };
                            }

                            const sPostingDate =
                                String(
                                    oRow.PostingDate ||
                                    ""
                                ).substring(
                                    0,
                                    10
                                );

                            const nQuantityInKG =
                                Number(
                                    oRow
                                        .QuantityInKG ||
                                    0
                                );

                            if (
                                !Number.isFinite(
                                    nQuantityInKG
                                )
                            ) {
                                return;
                            }

                            if (
                                sPostingDate <
                                sWeekStartDate
                            ) {
                                mCategories[
                                    sCategory
                                ].cumulativeValueKG +=
                                    nQuantityInKG;

                                return;
                            }

                            const iDayIndex =
                                aWeekDateKeys
                                    .indexOf(
                                        sPostingDate
                                    );

                            if (
                                iDayIndex >= 0
                            ) {
                                mCategories[
                                    sCategory
                                ].dailyValuesKG[
                                    iDayIndex
                                ] +=
                                    nQuantityInKG;
                            }
                        }
                    );

                    const aCategoryRows =
                        Object.values(
                            mCategories
                        )
                            .sort(
                                (
                                    oFirst,
                                    oSecond
                                ) =>
                                    oFirst
                                        .category
                                        .localeCompare(
                                            oSecond
                                                .category
                                        )
                            )
                            .map(
                                (
                                    oCategory
                                ) => {
                                    const nNetTotalKG =
                                        oCategory
                                            .dailyValuesKG
                                            .reduce(
                                                (
                                                    nTotal,
                                                    nDailyValue
                                                ) =>
                                                    nTotal +
                                                    nDailyValue,
                                                oCategory
                                                    .cumulativeValueKG
                                            );

                                    return {
                                        category:
                                            oCategory
                                                .category,

                                        cumulativeValue:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .cumulativeValueKG
                                                ),

                                        day1:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[0]
                                                ),

                                        day2:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[1]
                                                ),

                                        day3:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[2]
                                                ),

                                        day4:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[3]
                                                ),

                                        day5:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[4]
                                                ),

                                        day6:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[5]
                                                ),

                                        day7:
                                            this
                                                ._formatMetricTons(
                                                    oCategory
                                                        .dailyValuesKG[6]
                                                ),

                                        netTotal:
                                            this
                                                ._formatMetricTons(
                                                    nNetTotalKG
                                                ),

                                        cumulativeValueKG:
                                            oCategory
                                                .cumulativeValueKG,

                                        dailyValuesKG:
                                            oCategory
                                                .dailyValuesKG,

                                        netTotalKG:
                                            nNetTotalKG,

                                        isTotal:
                                            false,

                                        highlight:
                                            "None"
                                    };
                                }
                            );

                    const oGrandTotal =
                        aCategoryRows.reduce(
                            (
                                oTotal,
                                oRow
                            ) => {
                                oTotal
                                    .cumulativeValueKG +=
                                    oRow
                                        .cumulativeValueKG;

                                oRow
                                    .dailyValuesKG
                                    .forEach(
                                        (
                                            nDailyValue,
                                            iIndex
                                        ) => {
                                            oTotal
                                                .dailyValuesKG[
                                                    iIndex
                                                ] +=
                                                nDailyValue;
                                        }
                                    );

                                oTotal
                                    .netTotalKG +=
                                    oRow
                                        .netTotalKG;

                                return oTotal;
                            },
                            {
                                cumulativeValueKG:
                                    0,

                                dailyValuesKG:
                                    [
                                        0,
                                        0,
                                        0,
                                        0,
                                        0,
                                        0,
                                        0
                                    ],

                                netTotalKG:
                                    0
                            }
                        );

                    if (
                        aCategoryRows.length >
                        0
                    ) {
                        aCategoryRows.push({
                            category:
                                "TOTAL",

                            cumulativeValue:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .cumulativeValueKG
                                    ),

                            day1:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[0]
                                    ),

                            day2:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[1]
                                    ),

                            day3:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[2]
                                    ),

                            day4:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[3]
                                    ),

                            day5:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[4]
                                    ),

                            day6:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[5]
                                    ),

                            day7:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .dailyValuesKG[6]
                                    ),

                            netTotal:
                                this
                                    ._formatMetricTons(
                                        oGrandTotal
                                            .netTotalKG
                                    ),

                            isTotal:
                                true,

                            highlight:
                                "Success"
                        });
                    }

                    return aCategoryRows;
                }
            }
        );
    }
);