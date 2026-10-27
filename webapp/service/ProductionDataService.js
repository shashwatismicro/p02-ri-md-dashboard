sap.ui.define(
    [],
    function () {
        "use strict";

        function getServiceRoot(oModel) {
            return new URL(
                oModel.getServiceUrl(),
                window.location.origin
            ).toString();
        }

        async function requestProductionData(
            oModel,
            sKeyDate
        ) {
            if (!oModel) {
                throw new Error(
                    "Management Cockpit OData model is not available."
                );
            }

            if (!sKeyDate) {
                throw new Error(
                    "Production key date is required."
                );
            }

            const sServiceRoot =
                getServiceRoot(oModel);

            let sRequestUrl =
                new URL(
                    `Production/${sKeyDate}/Set`,
                    sServiceRoot
                ).toString();

            const aAllResults = [];

            while (sRequestUrl) {
                const oResponse =
                    await fetch(
                        sRequestUrl,
                        {
                            method: "GET",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            credentials:
                                "same-origin"
                        }
                    );

                if (!oResponse.ok) {
                    const sErrorText =
                        await oResponse.text();

                    throw new Error(
                        "Production request failed with HTTP " +
                        `${oResponse.status}: ${sErrorText}`
                    );
                }

                const oResponseData =
                    await oResponse.json();

                if (
                    Array.isArray(
                        oResponseData.value
                    )
                ) {
                    aAllResults.push(
                        ...oResponseData.value
                    );
                }

                const sNextLink =
                    oResponseData[
                        "@odata.nextLink"
                    ] || "";

                sRequestUrl =
                    sNextLink
                        ? new URL(
                            sNextLink,
                            sServiceRoot
                        ).toString()
                        : "";
            }

            return aAllResults;
        }

        return {
            requestProductionData
        };
    }
);